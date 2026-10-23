import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CampaignControllerService,
  SourceControllerService,
  Campaign,
  Library,
  SourceDocument,
  SearchHit,
} from '../../api/generated';

export interface LibraryFilters {
  types: string[];
  tags: string[];
  purposes: string[];
  statuses: string[];
  unclassified: boolean;
  issues: boolean;
}
const playFilters = (): LibraryFilters => ({
  types: [],
  tags: [],
  purposes: ['session'],
  statuses: ['current'],
  unclassified: false,
  issues: false,
});

@Injectable({ providedIn: 'root' })
export class LibraryState {
  private readonly campaignsApi = inject(CampaignControllerService);
  private readonly sourcesApi = inject(SourceControllerService);
  readonly campaigns = signal<Campaign[]>([]);
  readonly selected = signal<Campaign | null>(null);
  readonly library = signal<Library | null>(null);
  readonly document = signal<SourceDocument | null>(null);
  readonly query = signal('');
  readonly filters = signal<LibraryFilters>(playFilters());
  readonly browsing = signal(false);
  readonly groups = computed(() => {
    const groups = new Map<string, SearchHit[]>();
    for (const hit of this.results()) groups.set(hit.path, [...(groups.get(hit.path) ?? []), hit]);
    return [...groups].map(([path, hits]) => ({
      path,
      hits,
      classification: hits[0].classification,
    }));
  });
  readonly results = signal<SearchHit[]>([]);
  readonly error = signal('');
  readonly notice = signal('');
  readonly refreshing = signal(false);
  readonly loading = signal(false);
  beforeSelect: (id: string) => Promise<boolean> = async () => true;
  private initialized = false;
  private epoch = 0;
  private searchEpoch = 0;
  private documentEpoch = 0;

  async initialize(refresh = true) {
    if (this.initialized) return;
    this.initialized = true;
    const token = this.epoch;
    try {
      const list = await firstValueFrom(this.campaignsApi.listCampaigns());
      this.campaigns.update((items) => [
        ...list.campaigns,
        ...items.filter((item) => !list.campaigns.some((saved) => saved.id === item.id)),
      ]);
      if (token !== this.epoch) return;
      if (list.selected) await this.select(list.selected, refresh);
    } catch (error) {
      if (token === this.epoch) this.fail(error);
    }
  }
  async register(name: string, directory: string) {
    const token = ++this.epoch;
    this.refreshing.set(false);
    this.loading.set(false);
    this.error.set('');
    try {
      const campaign = await firstValueFrom(
        this.campaignsApi.registerCampaign({ name, directory }),
      );
      this.campaigns.update((items) => [...items, campaign]);
      if (token === this.epoch) await this.select(campaign.id);
    } catch (error) {
      if (token === this.epoch) this.fail(error);
    }
  }
  async select(id: string, refresh = true) {
    if (!(await this.beforeSelect(id))) return;
    const token = ++this.epoch;
    this.searchEpoch++;
    this.documentEpoch++;
    this.selected.set(this.campaigns().find((item) => item.id === id) ?? null);
    this.library.set(null);
    this.document.set(null);
    this.results.set([]);
    this.query.set('');
    this.filters.set(playFilters());
    this.browsing.set(false);
    this.error.set('');
    this.notice.set('');
    this.refreshing.set(false);
    this.loading.set(true);
    try {
      await firstValueFrom(this.campaignsApi.selectCampaign(id));
      const library = await firstValueFrom(this.sourcesApi.getLibrary(id));
      if (token !== this.epoch) return;
      this.library.set(library);
      if (refresh) await this.refresh();
      else await this.browse();
    } catch (error) {
      if (token === this.epoch) this.fail(error);
    } finally {
      if (token === this.epoch) this.loading.set(false);
    }
  }
  async refresh() {
    const campaign = this.selected();
    if (!campaign || this.refreshing()) return;
    const token = this.epoch;
    this.refreshing.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const library = await firstValueFrom(this.sourcesApi.refreshLibrary(campaign.id));
      if (token !== this.epoch) return;
      this.searchEpoch++;
      this.documentEpoch++;
      this.library.set({
        ...library,
        needsRefresh: library.needsRefresh || campaign.revision !== this.selected()?.revision,
      });
      this.document.set(null);
      this.results.set([]);
      this.notice.set('Library refreshed.');
      await this.browse();
    } catch (error) {
      if (token === this.epoch) this.fail(error);
    } finally {
      if (token === this.epoch) this.refreshing.set(false);
    }
  }
  async configure(includes: string, excludes: string) {
    const campaign = this.selected();
    if (!campaign) return;
    const token = this.epoch;
    const lines = (value: string) =>
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    this.error.set('');
    try {
      const updated = await firstValueFrom(
        this.campaignsApi.configureCampaign(campaign.id, {
          includes: lines(includes),
          excludes: lines(excludes),
          revision: campaign.revision,
        }),
      );
      if (token !== this.epoch) return;
      this.selected.set(updated);
      this.campaigns.update((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      this.library.update((value) => (value ? { ...value, needsRefresh: true } : value));
      this.notice.set('Source rules saved. Refresh to apply them.');
    } catch (error) {
      if (token === this.epoch) this.fail(error);
    }
  }
  changeQuery(query: string) {
    this.query.set(query);
    this.searchEpoch++;
    this.results.set([]);
  }
  async search(query: string) {
    this.query.set(query.trim());
    await this.browse();
  }
  async setFilters(change: Partial<LibraryFilters>) {
    this.filters.update((value) => ({ ...value, ...change }));
    await this.browse();
  }
  async searchAll() {
    this.filters.set({
      types: [],
      tags: [],
      purposes: [],
      statuses: [],
      unclassified: false,
      issues: false,
    });
    await this.browse();
  }
  async playLibrary() {
    this.filters.set(playFilters());
    await this.browse();
  }
  private async browse() {
    const library = this.library();
    if (!library?.capture) return;
    const token = this.epoch,
      request = ++this.searchEpoch;
    const f = this.filters(),
      query = this.query();
    const args = [
      new Set(f.types),
      new Set(f.tags),
      new Set(f.purposes),
      new Set(f.statuses),
    ] as const;
    // The API combines fields with AND. Two requests express the explicit diagnostic union.
    const modes =
      f.unclassified && f.issues
        ? [
            [true, false],
            [false, true],
          ]
        : [[f.unclassified, f.issues]];
    this.results.set([]);
    this.browsing.set(true);
    this.error.set('');
    try {
      const responses = await Promise.all(
        modes.map(async ([unclassified, issues]) => {
          const index = await firstValueFrom(
            this.sourcesApi.getLibrary(library.campaign, ...args, unclassified, issues),
          );
          const search = query
            ? await firstValueFrom(
                this.sourcesApi.searchSources(
                  library.campaign,
                  library.capture!,
                  query,
                  ...args,
                  unclassified,
                  issues,
                ),
              )
            : null;
          return { index, search };
        }),
      );
      if (
        token !== this.epoch ||
        request !== this.searchEpoch ||
        library.capture !== this.library()?.capture
      )
        return;
      if (
        responses.some(
          (r) =>
            r.index.capture !== library.capture ||
            (r.search && r.search.capture !== library.capture),
        )
      ) {
        await this.failRead(
          new HttpErrorResponse({
            status: 409,
            error: {
              code: 'sources.capture-replaced',
              detail: 'Library capture changed. Reopen the source.',
            },
          }),
        );
        return;
      }
      const documents = [
        ...new Map(responses.flatMap((r) => r.index.documents).map((d) => [d.path, d])).values(),
      ];
      const hits = [
        ...new Map(
          responses
            .flatMap((r) => r.search?.hits ?? [])
            .map((h) => [JSON.stringify([h.path, h.section, h.block]), h]),
        ).values(),
      ];
      this.library.update((value) => (value ? { ...value, documents } : value));
      this.results.set(hits);
    } catch (error) {
      if (
        token === this.epoch &&
        request === this.searchEpoch &&
        library.capture === this.library()?.capture
      )
        await this.failRead(error);
    } finally {
      if (token === this.epoch && request === this.searchEpoch) this.browsing.set(false);
    }
  }
  async open(path: string) {
    const library = this.library();
    if (!library?.capture) return;
    const token = this.epoch,
      request = ++this.documentEpoch;
    this.error.set('');
    try {
      const document = await firstValueFrom(
        this.sourcesApi.getSourceDocument(library.campaign, library.capture, path),
      );
      if (
        token !== this.epoch ||
        request !== this.documentEpoch ||
        library.capture !== this.library()?.capture
      )
        return;
      this.document.set(document);
    } catch (error) {
      if (token === this.epoch && request === this.documentEpoch) await this.failRead(error);
    }
  }
  private async failRead(error: unknown) {
    this.fail(error);
    if (error instanceof HttpErrorResponse && error.error?.code === 'sources.capture-replaced') {
      const campaign = this.selected(),
        token = this.epoch;
      if (!campaign) return;
      try {
        const library = await firstValueFrom(this.sourcesApi.getLibrary(campaign.id));
        if (token === this.epoch) {
          this.searchEpoch++;
          this.documentEpoch++;
          this.library.set(library);
          this.document.set(null);
          this.results.set([]);
          this.browsing.set(false);
          this.notice.set('Updated library loaded. Reopen a document.');
          await this.browse();
        }
      } catch (reloadError) {
        if (token === this.epoch) this.fail(reloadError);
      }
    }
  }
  private fail(error: unknown) {
    this.error.set(
      error instanceof HttpErrorResponse
        ? (error.error?.detail ?? 'Cannot reach the local backend.')
        : 'The operation failed. Please retry.',
    );
  }
}
