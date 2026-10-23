import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CardLibraryControllerService,
  SessionLibraryControllerService,
  SourceControllerService,
  LibraryEntry,
  LibraryDocument,
  SessionLibraryEntry,
  CheckedLink,
} from '../../api/generated';
import { LibraryState, LibraryFilters } from './library-state';
import { WritingState } from '../writing/writing-state';
import { SessionState } from '../preparation/session-state';

const json = { httpHeaderAccept: 'application/json' as const };
const allCriteria = [
  undefined,
  new Set<string>(),
  new Set<string>(),
  new Set<string>(),
  new Set<string>(),
  false,
  false,
] as const;
const defaults = (): LibraryFilters => ({
  types: [],
  tags: [],
  purposes: ['session'],
  statuses: ['current'],
  unclassified: false,
  issues: false,
});
const signature = (entry: LibraryEntry) =>
  JSON.stringify([
    entry.key,
    entry.draft,
    entry.revision,
    entry.sources,
    entry.conflicts,
    entry.ready,
  ]);

@Injectable({ providedIn: 'root' })
export class UnifiedLibraryState {
  private readonly api = inject(CardLibraryControllerService);
  private readonly sessionApi = inject(SessionLibraryControllerService);
  private readonly sourcesApi = inject(SourceControllerService);
  private readonly campaigns = inject(LibraryState);
  private readonly writing = inject(WritingState);
  private readonly preparation = inject(SessionState);
  readonly selected = this.campaigns.selected;
  readonly campaign = signal('');
  readonly session = signal('');
  readonly query = signal('');
  readonly filters = signal<LibraryFilters>(defaults());
  readonly entries = signal<LibraryEntry[]>([]);
  readonly statuses = signal<SessionLibraryEntry[]>([]);
  readonly capture = signal<string | null>(null);
  readonly revision = signal<number | null>(null);
  readonly selectedEntry = signal<LibraryEntry | null>(null);
  readonly document = signal<LibraryDocument | null>(null);
  readonly documentCapture = signal<string | null>(null);
  readonly mode = signal<'document' | 'card'>('document');
  readonly error = signal('');
  readonly notice = signal('');
  readonly loading = signal(false);
  readonly reading = signal(false);
  readonly adding = signal(false);
  readonly editing = signal(false);
  readonly refreshing = signal(false);
  readonly stale = signal(false);
  readonly assemblyRunning = signal(false);
  readonly assembly = signal<{ entry: LibraryEntry; status: 'pending' | 'completed' | 'failed' }[]>(
    [],
  );
  private assemblyContext: {
    campaign: string;
    session: string;
    capture: string | null;
    epoch: number;
  } | null = null;
  readonly status = computed(() =>
    this.statuses().find((s) => s.entry.key === this.selectedEntry()?.key),
  );
  readonly blocked = computed(
    () =>
      !this.document()?.entry?.ready ||
      !!this.document()?.entry?.conflicts?.length ||
      this.stale() ||
      this.reading(),
  );
  private epoch = 0;
  private catalogueRequest = 0;
  private readerRequest = 0;

  detach() {
    this.epoch++;
    this.readerRequest++;
    this.catalogueRequest++;
    this.reading.set(false);
  }
  async bind(campaign: string, session: string) {
    const changed = campaign !== this.campaign();
    if (!changed && session === this.session()) return;
    this.epoch++;
    this.assembly.set([]);
    this.assemblyContext = null;
    this.campaign.set(campaign);
    this.session.set(session);
    this.statuses.set([]);
    this.revision.set(null);
    this.error.set('');
    this.notice.set('');
    if (changed) {
      this.readerRequest++;
      this.reading.set(false);
      this.entries.set([]);
      this.selectedEntry.set(null);
      this.document.set(null);
      this.query.set('');
      this.filters.set(defaults());
      this.capture.set(null);
    }
    await this.reload();
  }
  changeQuery(query: string) {
    this.query.set(query);
    this.catalogueRequest++;
  }
  async search(query: string) {
    this.query.set(query.trim());
    await this.reload();
  }
  async setFilters(change: Partial<LibraryFilters>) {
    this.filters.update((f) => ({ ...f, ...change }));
    await this.reload();
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
    await this.reload();
  }
  async playLibrary() {
    this.filters.set(defaults());
    await this.reload();
  }
  async reload() {
    const campaign = this.campaign(),
      session = this.session(),
      epoch = this.epoch,
      request = ++this.catalogueRequest;
    if (!campaign) return;
    this.loading.set(true);
    this.error.set('');
    const f = this.filters();
    const modes =
      f.unclassified && f.issues
        ? [
            [true, false],
            [false, true],
          ]
        : [[f.unclassified, f.issues]];
    try {
      const results = await Promise.all(
        modes.map(async ([unclassified, issues]) => {
          const args = [
            this.query() || undefined,
            new Set(f.types),
            new Set(f.tags),
            new Set(f.purposes),
            new Set(f.statuses),
            unclassified,
            issues,
          ] as const;
          if (session) {
            const result = await firstValueFrom(
              this.sessionApi.listSessionLibraryCards(
                campaign,
                session,
                ...args,
                'body',
                false,
                json,
              ),
            );
            return {
              capture: result.capture,
              entries: result.entries.map((e) => e.entry),
              statuses: result.entries,
              revision: result.revision,
            };
          }
          const result = await firstValueFrom(
            this.api.listLibraryCards(campaign, ...args, 'body', false, json),
          );
          return {
            capture: result.capture ?? null,
            entries: result.entries ?? [],
            statuses: [],
            revision: null,
          };
        }),
      );
      if (epoch !== this.epoch || request !== this.catalogueRequest) return;
      if (
        results.some((r) => r.capture !== results[0].capture || r.revision !== results[0].revision)
      )
        throw new Error('Catalogue changed while loading. Retry catalogue.');
      this.capture.set(results[0].capture);
      this.revision.set(results[0].revision);
      this.entries.set([
        ...new Map(results.flatMap((r) => r.entries).map((e) => [e.key, e])).values(),
      ]);
      let statuses = [
        ...new Map(results.flatMap((r) => r.statuses).map((e) => [e.entry.key, e])).values(),
      ];
      const opened = this.document()?.entry;
      // Status belongs to the selected document even when a search hides its catalogue row.
      if (session && opened && !statuses.some((s) => s.entry.key === opened.key)) {
        const selectedStatus = await firstValueFrom(
          this.sessionApi.listSessionLibraryCards(
            campaign,
            session,
            ...allCriteria,
            'body',
            false,
            json,
          ),
        );
        if (epoch !== this.epoch || request !== this.catalogueRequest) return;
        if (
          selectedStatus.capture !== this.capture() ||
          selectedStatus.revision !== this.revision()
        )
          throw new Error('Session changed while loading. Reload catalogue.');
        statuses = [
          ...statuses,
          ...selectedStatus.entries.filter((s) => s.entry.key === opened.key),
        ];
      }
      this.statuses.set(statuses);
      let current =
        this.entries().find((e) => e.key === opened?.key) ??
        statuses.find((s) => s.entry.key === opened?.key)?.entry;
      if (opened && !current && !session) {
        const all = await firstValueFrom(
          this.api.listLibraryCards(campaign, ...allCriteria, 'body', false, json),
        );
        if (epoch !== this.epoch || request !== this.catalogueRequest) return;
        current = all.entries?.find((e) => e.key === opened.key);
      }
      // Filtering may hide an open document; it remains readable but cannot mutate without current status.
      if (
        opened &&
        (this.capture() !== this.documentCapture() ||
          !current ||
          signature(current) !== signature(opened))
      )
        this.stale.set(true);
    } catch (error) {
      if (epoch === this.epoch && request === this.catalogueRequest) {
        this.fail(error);
        this.revision.set(null);
        this.statuses.set([]);
      }
    } finally {
      if (epoch === this.epoch && request === this.catalogueRequest) this.loading.set(false);
    }
  }
  async open(entry: LibraryEntry, sourcePath?: string) {
    if (this.assemblyRunning()) return;
    const campaign = this.campaign(),
      capture = this.capture(),
      request = ++this.readerRequest;
    this.assembly.set([]);
    this.assemblyContext = null;
    this.selectedEntry.set(entry);
    this.document.set(null);
    this.mode.set('document');
    this.stale.set(false);
    this.reading.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const document = await firstValueFrom(
        this.api.readLibraryCard(
          campaign,
          entry.key!,
          capture ?? undefined,
          entry.revision ?? undefined,
          sourcePath,
          entry.draft ?? undefined,
          'body',
          false,
          json,
        ),
      );
      if (campaign !== this.campaign() || request !== this.readerRequest) return;
      this.document.set(document);
      this.documentCapture.set(capture);
      this.stale.set(capture !== this.capture());
    } catch (error) {
      if (campaign === this.campaign() && request === this.readerRequest) {
        this.fail(error);
        this.stale.set(true);
      }
    } finally {
      if (campaign === this.campaign() && request === this.readerRequest) this.reading.set(false);
    }
  }
  async openKey(
    key: string,
    expected?: { capture: string | null; draft: string | null; revision: number | null },
  ) {
    const campaign = this.campaign(),
      epoch = this.epoch;
    try {
      const all = await firstValueFrom(
        this.api.listLibraryCards(campaign, ...allCriteria, 'body', false, json),
      );
      if (epoch !== this.epoch) return;
      if (all.capture !== this.capture())
        throw new Error('Library changed. Reload catalogue before opening this reference.');
      const entry = all.entries?.find((e) => e.key === key);
      if (
        entry &&
        expected &&
        (all.capture !== expected.capture ||
          (entry.draft ?? null) !== expected.draft ||
          (entry.revision ?? null) !== expected.revision)
      ) {
        this.selectedEntry.set(entry);
        this.document.set(null);
        this.stale.set(true);
        throw new Error(
          'The selected reference changed. Reload the selected document explicitly to read its current saved version.',
        );
      }
      if (entry) await this.open(entry);
      else this.error.set('The selected reference is no longer available.');
    } catch (error) {
      if (epoch === this.epoch) this.fail(error);
    }
  }
  async reopen() {
    const key = this.selectedEntry()?.key,
      campaign = this.campaign(),
      epoch = this.epoch;
    await this.reload();
    if (epoch !== this.epoch) return;
    try {
      const all = await firstValueFrom(
        this.api.listLibraryCards(campaign, ...allCriteria, 'body', false, json),
      );
      if (epoch !== this.epoch) return;
      if (all.capture !== this.capture())
        throw new Error('Capture changed again. Reload catalogue.');
      const entry = all.entries?.find((e) => e.key === key);
      if (entry) await this.open(entry);
      else {
        this.stale.set(true);
        this.error.set('This document is no longer available. Choose another document.');
      }
    } catch (error) {
      if (epoch === this.epoch) this.fail(error);
    }
  }
  async refresh() {
    if (this.refreshing()) return;
    const campaign = this.campaign();
    this.refreshing.set(true);
    try {
      await firstValueFrom(this.sourcesApi.refreshLibrary(campaign));
      if (campaign !== this.campaign()) return;
      this.stale.set(!!this.document());
      await this.reload();
      this.notice.set(
        'Sources refreshed. Reload the selected document before editing or adding it.',
      );
    } catch (error) {
      if (campaign === this.campaign()) this.fail(error);
    } finally {
      this.refreshing.set(false);
    }
  }
  async add(): Promise<boolean> {
    const entry = this.document()?.entry,
      campaign = this.campaign(),
      session = this.session();
    const capture = this.documentCapture(),
      revision = this.revision(),
      epoch = this.epoch,
      reader = this.readerRequest,
      preparationRevision = this.preparation.current()?.revision;
    if (
      !entry?.key ||
      !session ||
      revision === null ||
      this.blocked() ||
      !this.status() ||
      this.assemblyRunning() ||
      this.adding()
    )
      return false;
    this.adding.set(true);
    this.error.set('');
    let dispatched = false;
    try {
      if (
        !(await this.writing.flush()) ||
        !(await this.preparation.flush()) ||
        !(await this.preparation.play.flush())
      ) {
        throw new Error(
          'Pending workspace changes could not be saved. Return to the workspace to retry or reload.',
        );
      }
      // A switch during a save cancels before mutation. A switch after dispatch cannot redirect it.
      if (epoch !== this.epoch || reader !== this.readerRequest) return false;
      dispatched = true;
      const result = await firstValueFrom(
        this.sessionApi.addSessionLibraryCard(
          campaign,
          session,
          {
            revision:
              this.preparation.current()?.id === session &&
              this.preparation.current()?.campaign === campaign &&
              this.preparation.current()?.revision !== preparationRevision
                ? this.preparation.current()!.revision
                : revision,
            key: entry.key,
            capture,
            draft: entry.draft ?? null,
            draftRevision: entry.revision ?? null,
          },
          'body',
          false,
          json,
        ),
      );
      this.preparation.invalidateLibraryMembership(campaign, session);
      if (epoch !== this.epoch) return false;
      await this.reload();
      if (epoch === this.epoch && reader === this.readerRequest)
        this.notice.set(result.added ? 'Added to session.' : 'Already in session.');
      return epoch === this.epoch && reader === this.readerRequest && !this.error();
    } catch (error) {
      if (epoch === this.epoch && reader === this.readerRequest) {
        this.fail(error);
        if (error instanceof HttpErrorResponse && error.status === 409) this.stale.set(true);
      }
      return false;
    } finally {
      // An uncertain HTTP result may still have committed. Reopen through Preparation's owner.
      if (dispatched) this.preparation.invalidateLibraryMembership(campaign, session);
      this.adding.set(false);
    }
  }
  async startAssembly(entries: LibraryEntry[]): Promise<boolean> {
    if (
      this.assemblyRunning() ||
      this.adding() ||
      this.blocked() ||
      !this.session() ||
      !entries.length
    )
      return false;
    this.assemblyContext = {
      campaign: this.campaign(),
      session: this.session(),
      capture: this.documentCapture(),
      epoch: this.epoch,
    };
    this.assembly.set([
      ...new Map(
        entries.map((entry) => [entry.key, { entry, status: 'pending' as const }]),
      ).values(),
    ]);
    return this.retryAssembly();
  }
  async retryAssembly(): Promise<boolean> {
    const pin = this.assemblyContext;
    if (!pin || pin.epoch !== this.epoch || this.assemblyRunning() || this.adding()) return false;
    const active = () =>
      pin.epoch === this.epoch &&
      pin.campaign === this.campaign() &&
      pin.session === this.session();
    this.assemblyRunning.set(true);
    this.error.set('');
    try {
      if (
        !(await this.writing.flush()) ||
        !(await this.preparation.flush()) ||
        !(await this.preparation.play.flush())
      )
        throw new Error('Save pending workspace changes before adding Adventure material.');
      for (let index = 0; index < this.assembly().length; index++) {
        if (!active()) return false;
        const choice = this.assembly()[index];
        if (choice.status === 'completed') continue;
        try {
          // Reconcile uncertain results before retry; never replace an existing frozen card.
          const catalogue = await firstValueFrom(
            this.sessionApi.listSessionLibraryCards(
              pin.campaign,
              pin.session,
              ...allCriteria,
              'body',
              false,
              json,
            ),
          );
          if (!active()) return false;
          if (catalogue.capture !== pin.capture)
            throw new Error('Sources changed. Review Adventure material again.');
          const current = catalogue.entries.find((e) => e.entry.key === choice.entry.key);
          if (!current)
            throw new Error('Selected card is unavailable. Review Adventure material again.');
          if (!current.entry.ready || current.entry.conflicts?.length)
            throw new Error('Selected card is blocked. Review Adventure material again.');
          if (!current.matches.length) {
            if (signature(current.entry) !== signature(choice.entry))
              throw new Error('Selected card changed. Review Adventure material again.');
            await firstValueFrom(
              this.sessionApi.addSessionLibraryCard(
                pin.campaign,
                pin.session,
                {
                  revision: catalogue.revision,
                  key: choice.entry.key!,
                  capture: pin.capture,
                  draft: choice.entry.draft ?? null,
                  draftRevision: choice.entry.revision ?? null,
                },
                'body',
                false,
                json,
              ),
            );
          }
          if (!active()) return false;
          this.assembly.update((items) =>
            items.map((item, i) => (i === index ? { ...item, status: 'completed' } : item)),
          );
        } catch (error) {
          if (active()) {
            this.assembly.update((items) =>
              items.map((item, i) => (i === index ? { ...item, status: 'failed' } : item)),
            );
            this.fail(error);
          }
          break;
        } finally {
          this.preparation.invalidateLibraryMembership(pin.campaign, pin.session);
        }
      }
      return active();
    } catch (error) {
      if (active()) this.fail(error);
      return active();
    } finally {
      this.assemblyRunning.set(false);
      if (active()) {
        const failure = this.error();
        await this.reload();
        if (active() && failure && !this.error()) this.error.set(failure);
      }
    }
  }
  async edit(): Promise<string | null> {
    const entry = this.document()?.entry,
      campaign = this.campaign(),
      epoch = this.epoch,
      reader = this.readerRequest,
      capture = this.documentCapture();
    if (!entry || this.stale() || (!entry.draft && entry.conflicts?.length) || this.editing())
      return null;
    if (entry.draft) return entry.draft;
    const path = this.document()?.source?.path;
    if (!path || !this.documentCapture()) return null;
    this.editing.set(true);
    try {
      if (!(await this.writing.flush()))
        throw new Error('Save pending Writing changes before editing this Source.');
      if (epoch !== this.epoch || reader !== this.readerRequest) return null;
      const draft = await firstValueFrom(
        this.api.editLibrarySource(campaign, { capture: capture!, path }, 'body', false, json),
      );
      return epoch === this.epoch && reader === this.readerRequest ? draft.id : null;
    } catch (error) {
      if (epoch === this.epoch) this.fail(error);
      return null;
    } finally {
      this.editing.set(false);
    }
  }
  async follow(link: Pick<CheckedLink, 'kind'> & Partial<Pick<CheckedLink, 'path' | 'draft'>>) {
    const campaign = this.campaign(),
      epoch = this.epoch;
    try {
      const all = await firstValueFrom(
        this.api.listLibraryCards(campaign, ...allCriteria, 'body', false, json),
      );
      if (epoch !== this.epoch) return;
      if (all.capture !== this.capture()) {
        this.stale.set(true);
        throw new Error('Capture changed. Reload catalogue before following links.');
      }
      const entry = all.entries?.find((e) =>
        link.kind === 'draft'
          ? e.draft === link.draft
          : e.sources?.some((s) => s.path === link.path),
      );
      if (entry) await this.open(entry);
      else this.error.set('Link target is unavailable in the captured Library.');
    } catch (error) {
      if (epoch === this.epoch) this.fail(error);
    }
  }
  private fail(error: unknown) {
    this.error.set(
      error instanceof HttpErrorResponse
        ? (error.error?.detail ?? 'Cannot reach the local backend. Retry the operation.')
        : error instanceof Error
          ? error.message
          : 'Operation failed. Retry.',
    );
  }
}
