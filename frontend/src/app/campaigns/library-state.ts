import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CampaignControllerService, SourceControllerService, Campaign, Library, SourceDocument, SearchHit } from '../../api/generated';

@Injectable()
export class LibraryState {
  private readonly campaignsApi = inject(CampaignControllerService);
  private readonly sourcesApi = inject(SourceControllerService);
  readonly campaigns = signal<Campaign[]>([]);
  readonly selected = signal<Campaign | null>(null);
  readonly library = signal<Library | null>(null);
  readonly document = signal<SourceDocument | null>(null);
  readonly results = signal<SearchHit[]>([]);
  readonly error = signal('');
  readonly notice = signal('');
  readonly refreshing = signal(false);
  readonly loading = signal(false);
  private epoch = 0;
  private searchEpoch = 0;
  private documentEpoch = 0;

  async initialize() {
    const token = this.epoch;
    try {
      const list = await firstValueFrom(this.campaignsApi.listCampaigns());
      this.campaigns.update(items => [
        ...list.campaigns,
        ...items.filter(item => !list.campaigns.some(saved => saved.id === item.id)),
      ]);
      if (token !== this.epoch) return;
      if (list.selected) await this.select(list.selected);
    } catch (error) { if (token === this.epoch) this.fail(error); }
  }
  async register(name: string, directory: string) {
    const token = ++this.epoch;
    this.refreshing.set(false); this.loading.set(false);
    this.error.set('');
    try {
      const campaign = await firstValueFrom(this.campaignsApi.registerCampaign({ name, directory }));
      this.campaigns.update(items => [...items, campaign]);
      if (token === this.epoch) await this.select(campaign.id);
    } catch (error) { if (token === this.epoch) this.fail(error); }
  }
  async select(id: string) {
    const token = ++this.epoch;
    this.searchEpoch++; this.documentEpoch++;
    this.selected.set(this.campaigns().find(item => item.id === id) ?? null);
    this.library.set(null); this.document.set(null); this.results.set([]);
    this.error.set(''); this.notice.set(''); this.refreshing.set(false); this.loading.set(true);
    try {
      await firstValueFrom(this.campaignsApi.selectCampaign(id));
      const library = await firstValueFrom(this.sourcesApi.getLibrary(id));
      if (token !== this.epoch) return;
      this.library.set(library);
      await this.refresh();
    } catch (error) { if (token === this.epoch) this.fail(error); }
    finally { if (token === this.epoch) this.loading.set(false); }
  }
  async refresh() {
    const campaign = this.selected(); if (!campaign || this.refreshing()) return;
    const token = this.epoch;
    this.refreshing.set(true); this.error.set(''); this.notice.set('');
    try {
      const library = await firstValueFrom(this.sourcesApi.refreshLibrary(campaign.id));
      if (token !== this.epoch) return;
      this.searchEpoch++; this.documentEpoch++;
      this.library.set({ ...library, needsRefresh: library.needsRefresh || campaign.revision !== this.selected()?.revision });
      this.document.set(null); this.results.set([]);
      this.notice.set('Library refreshed.');
    } catch (error) { if (token === this.epoch) this.fail(error); }
    finally { if (token === this.epoch) this.refreshing.set(false); }
  }
  async configure(includes: string, excludes: string) {
    const campaign = this.selected(); if (!campaign) return;
    const token = this.epoch;
    const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
    this.error.set('');
    try {
      const updated = await firstValueFrom(this.campaignsApi.configureCampaign(campaign.id, { includes: lines(includes), excludes: lines(excludes), revision: campaign.revision }));
      if (token !== this.epoch) return;
      this.selected.set(updated);
      this.campaigns.update(items => items.map(item => item.id === updated.id ? updated : item));
      this.library.update(value => value ? { ...value, needsRefresh: true } : value);
      this.notice.set('Source rules saved. Refresh to apply them.');
    } catch (error) { if (token === this.epoch) this.fail(error); }
  }
  async search(query: string) {
    const library = this.library(); if (!library?.capture) return;
    const token = this.epoch, request = ++this.searchEpoch;
    this.error.set('');
    try {
      const result = await firstValueFrom(this.sourcesApi.searchSources(library.campaign, library.capture, query));
      if (token === this.epoch && request === this.searchEpoch && library.capture === this.library()?.capture) this.results.set(result.hits);
    } catch (error) { if (token === this.epoch && request === this.searchEpoch) await this.failRead(error); }
  }
  async open(path: string, section?: string | null, block?: string | null) {
    const library = this.library(); if (!library?.capture) return;
    const token = this.epoch, request = ++this.documentEpoch;
    this.error.set('');
    try {
      const document = await firstValueFrom(this.sourcesApi.getSourceDocument(library.campaign, library.capture, path));
      if (token !== this.epoch || request !== this.documentEpoch || library.capture !== this.library()?.capture) return;
      this.document.set(document);
      // Wait for Angular to render the requested passage; scrolling does not insert HTML.
      setTimeout(() => {
        if (token === this.epoch && request === this.documentEpoch) {
          const target = window.document.getElementById(block ?? section ?? 'source-reader');
          target?.scrollIntoView({ block: 'center' }); target?.focus({ preventScroll: true });
        }
      });
    } catch (error) { if (token === this.epoch && request === this.documentEpoch) await this.failRead(error); }
  }
  follow(event: MouseEvent) {
    const element = event.target;
    if (!(element instanceof Element)) return;
    const anchor = element.closest('a'); if (!anchor) return;
    event.preventDefault();
    const key = anchor.getAttribute('href')?.split('#')[1];
    const link = this.document()?.links.find(item => item.key === key);
    if (!link || link.missing) { this.error.set('This link target is missing, excluded, or unsupported.'); return; }
    if (link.external) { window.open(link.external, '_blank', 'noopener,noreferrer'); return; }
    if (link.document) void this.open(link.document, link.section);
  }
  private async failRead(error: unknown) {
    this.fail(error);
    if (error instanceof HttpErrorResponse && error.error?.code === 'sources.capture-replaced') {
      const campaign = this.selected(), token = this.epoch;
      if (!campaign) return;
      try {
        const library = await firstValueFrom(this.sourcesApi.getLibrary(campaign.id));
        if (token === this.epoch) {
          this.searchEpoch++; this.documentEpoch++;
          this.library.set(library); this.document.set(null); this.results.set([]);
          this.notice.set('Updated library loaded. Repeat your search or reopen a document.');
        }
      } catch (reloadError) { if (token === this.epoch) this.fail(reloadError); }
    }
  }
  private fail(error: unknown) {
    this.error.set(error instanceof HttpErrorResponse ? error.error?.detail ?? 'Cannot reach the local backend.' : 'The operation failed. Please retry.');
  }
}
