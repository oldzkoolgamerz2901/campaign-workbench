import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PlayWorkspaceState } from '../playthroughs/workspace-state';
import { transferError } from '../shared/transfer-error';
import { firstValueFrom, Observable } from 'rxjs';
import {
  PreparationControllerService,
  SessionData,
  SessionSummary,
  RenderedMarkdown,
  SessionView,
  PortableSessionControllerService,
  SessionLibraryControllerService,
  LibraryEntry,
} from '../../api/generated';

export interface SourceSelection {
  path: string;
  section: string | null;
  title?: string;
}
export interface AdditionProgress extends SourceSelection {
  status: 'pending' | 'completed' | 'failed';
}

@Injectable({ providedIn: 'root' })
export class SessionState {
  readonly play = inject(PlayWorkspaceState);
  private readonly api = inject(PreparationControllerService);
  private readonly sessionLibrary = inject(SessionLibraryControllerService);
  private readonly portable = inject(PortableSessionControllerService);
  readonly transferBusy = signal(false);
  readonly sessions = signal<SessionSummary[]>([]);
  readonly current = signal<SessionData | null>(null);
  readonly selectedItem = signal<string | null>(null);
  readonly status = signal<'saved' | 'pending' | 'saving' | 'failed'>('saved');
  readonly error = signal('');
  readonly notice = signal('');
  readonly rendered = signal<SessionView | null>(null);
  readonly previews = signal<Record<string, RenderedMarkdown>>({});
  readonly mutating = signal(false);
  readonly checkingRemoval = signal(false);
  readonly queueRunning = signal(false);
  readonly additions = signal<AdditionProgress[]>([]);
  private queueIdentity?: { campaign: string; session: string; capture: string };
  readonly loading = signal(false);
  private activeCampaign: string | null = null;
  private generation = 0;
  private epoch = 0;
  private listEpoch = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private previewTimer?: ReturnType<typeof setTimeout>;
  private previewEpoch = 0;
  private readonly previewTexts = new Map<string, string>();
  private readonly pendingPreviews = new Set<string>();
  private dirty = false;
  private saving?: Promise<boolean>;
  private mutation?: Promise<void>;

  hasUnsaved() {
    return (
      this.play.hasUnsaved() ||
      this.transferBusy() ||
      this.dirty ||
      !!this.saving ||
      this.mutating() ||
      this.checkingRemoval() ||
      this.queueRunning()
    );
  }
  bindCampaign(campaign: string) {
    if (this.activeCampaign === campaign) return;
    this.clear();
    this.activeCampaign = campaign;
  }
  async list(campaign: string) {
    if (campaign !== this.activeCampaign) return;
    const epoch = ++this.listEpoch;
    try {
      const result = await firstValueFrom(
        this.api.listSessions(campaign, 'body', false, { httpHeaderAccept: 'application/json' }),
      );
      if (epoch === this.listEpoch && campaign === this.activeCampaign)
        this.sessions.set(result.sessions);
    } catch (e) {
      if (epoch === this.listEpoch) this.fail(e);
    }
  }
  async create(campaign: string, title: string, objective: string): Promise<SessionData | null> {
    if (campaign !== this.activeCampaign || !(await this.allowLeave())) return null;
    const epoch = this.epoch;
    try {
      const s = await firstValueFrom(
        this.api.createSession(campaign, { title, objective }, 'body', false, {
          httpHeaderAccept: 'application/json',
        }),
      );
      if (epoch !== this.epoch || campaign !== this.activeCampaign) return null;
      await this.list(campaign);
      return epoch === this.epoch && campaign === this.activeCampaign ? s : null;
    } catch (e) {
      if (epoch === this.epoch && campaign === this.activeCampaign) this.fail(e);
      return null;
    }
  }
  private readonly invalidatedMembership = new Set<string>();
  invalidateLibraryMembership(campaign: string, id: string) {
    this.invalidatedMembership.add(`${campaign}:${id}`);
  }
  async open(campaign: string, id: string, reload = false): Promise<boolean> {
    this.bindCampaign(campaign);
    const sameSession = this.current()?.id === id && this.current()?.campaign === campaign;
    if (sameSession && !reload && !this.invalidatedMembership.has(`${campaign}:${id}`)) return true;
    if (!sameSession) this.play.clear();
    this.saving = undefined;
    const epoch = ++this.epoch;
    this.previewEpoch++;
    this.notice.set('');
    this.loading.set(true);
    this.current.set(null);
    this.rendered.set(null);
    this.previews.set({});
    this.previewTexts.clear();
    this.pendingPreviews.clear();
    this.dirty = false;
    this.error.set('');
    this.status.set('saved');
    clearTimeout(this.timer);
    try {
      const s = await firstValueFrom(
        this.api.openSession(campaign, id, 'body', false, { httpHeaderAccept: 'application/json' }),
      );
      if (epoch !== this.epoch) return false;
      this.invalidatedMembership.delete(`${campaign}:${id}`);
      this.current.set(s);
      this.selectedItem.set(s.items[0]?.id ?? null);
      await this.renderSources();
      if (epoch !== this.epoch) return false;
      this.queuePreview();
      return true;
    } catch (e) {
      if (epoch === this.epoch) this.fail(e);
      return false;
    } finally {
      if (epoch === this.epoch) this.loading.set(false);
    }
  }
  clear() {
    this.play.clear();
    this.saving = undefined;
    this.additions.set([]);
    this.queueIdentity = undefined;
    this.epoch++;
    this.listEpoch++;
    this.previewEpoch++;
    this.current.set(null);
    this.loading.set(false);
    this.notice.set('');
    this.sessions.set([]);
    this.rendered.set(null);
    this.previews.set({});
    this.previewTexts.clear();
    this.pendingPreviews.clear();
    clearTimeout(this.timer);
    clearTimeout(this.previewTimer);
    this.dirty = false;
    this.status.set('saved');
    this.error.set('');
    this.selectedItem.set(null);
  }
  edit(change: Partial<Pick<SessionData, 'title' | 'objective' | 'notes' | 'items'>>) {
    if (!this.current()) return;
    const previous = this.current()!;
    this.current.update((s) => (s ? { ...s, ...change } : s));
    this.generation++;
    this.dirty = true;
    // A failed save stays explicit until Retry, Reload, or Discard; further edits remain local.
    if (this.status() !== 'failed') {
      this.status.set(this.saving ? 'saving' : 'pending');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush(), 500);
    }
    const changed: string[] = [];
    if (change.notes !== undefined && change.notes !== previous.notes) changed.push('session');
    if (change.items) {
      const oldNotes = new Map(previous.items.map((item) => [item.id, item.notes]));
      for (const item of change.items)
        if (oldNotes.get(item.id) !== item.notes) changed.push(item.id);
      const retained = new Set(change.items.map((item) => item.id));
      for (const id of this.previewTexts.keys())
        if (id !== 'session' && !retained.has(id)) {
          this.previewTexts.delete(id);
          this.pendingPreviews.delete(id);
        }
      this.previews.update((values) =>
        Object.fromEntries(
          Object.entries(values).filter(([id]) => id === 'session' || retained.has(id)),
        ),
      );
    }
    if (changed.length) this.queuePreview(changed);
  }
  selectItem(id: string | null) {
    this.selectedItem.set(id);
    this.queuePreview(id ? [id] : ['session']);
  }
  editItemNotes(id: string, notes: string) {
    this.edit({ items: this.current()!.items.map((i) => (i.id === id ? { ...i, notes } : i)) });
  }
  move(id: string, delta: number) {
    if (this.queueRunning()) return;
    const items = [...(this.current()?.items ?? [])],
      from = items.findIndex((i) => i.id === id),
      to = from + delta;
    if (from < 0 || to < 0 || to >= items.length) return;
    [items[from], items[to]] = [items[to], items[from]];
    this.edit({ items });
  }
  remove(id: string) {
    if (this.queueRunning()) return;
    const items = this.current()!.items.filter((i) => i.id !== id);
    this.edit({ items });
    this.current.update((s) =>
      s
        ? { ...s, sceneLinks: s.sceneLinks.filter((link) => link.scene !== id && link.item !== id) }
        : s,
    );
    if (this.selectedItem() === id) this.selectItem(items[0]?.id ?? null);
  }
  async changeSceneLink(scene: string, item: string, linked: boolean) {
    return this.sessionCommand((s) =>
      this.api.changeSceneAssociation(
        s.campaign,
        s.id,
        scene,
        item,
        { revision: s.revision, linked },
        'body',
        false,
        { httpHeaderAccept: 'application/json' },
      ),
    );
  }
  async replaceFromLibrary(item: string, entry: LibraryEntry, capture: string | null) {
    return this.sessionCommand((s) =>
      this.sessionLibrary.replacePreparedLibraryCard(
        s.campaign,
        s.id,
        item,
        {
          revision: s.revision,
          key: entry.key!,
          capture,
          draft: entry.draft ?? null,
          draftRevision: entry.revision ?? null,
        },
        'body',
        false,
        { httpHeaderAccept: 'application/json' },
      ),
    );
  }
  async removeWithConfirmation(id: string) {
    const epoch = this.epoch;
    if (
      this.queueRunning() ||
      this.mutating() ||
      this.checkingRemoval() ||
      !(await this.flush()) ||
      epoch !== this.epoch
    )
      return false;
    const snapshot = this.current();
    if (!snapshot) return false;
    this.checkingRemoval.set(true);
    try {
      const impact = await firstValueFrom(
        this.api.preparedRemovalImpact(snapshot.campaign, snapshot.id, id),
      );
      if (epoch !== this.epoch || !this.current()?.items.some((i) => i.id === id)) return false;
      if (impact.revision !== this.current()?.revision) {
        this.error.set('The session changed. Reload the session before removing this card.');
        return false;
      }
      if (
        impact.scenes.length &&
        !window.confirm(
          `Remove this prepared card? This also removes its links with Scenes: ${impact.scenes.map((s) => s.title).join(', ')}. Library documents remain available.`,
        )
      )
        return false;
      return await this.sessionCommand((s) =>
        this.api.saveSession(
          s.campaign,
          s.id,
          {
            revision: s.revision,
            title: s.title,
            objective: s.objective,
            notes: s.notes,
            items: s.items.filter((i) => i.id !== id).map((i) => ({ id: i.id, notes: i.notes })),
          },
          'body',
          false,
          { httpHeaderAccept: 'application/json' },
        ),
      );
    } catch (error) {
      if (epoch === this.epoch) this.fail(error);
      return false;
    } finally {
      this.checkingRemoval.set(false);
    }
  }
  private async sessionCommand(
    command: (snapshot: SessionData) => Observable<SessionData>,
  ): Promise<boolean> {
    const epoch = this.epoch;
    if (
      this.queueRunning() ||
      this.mutating() ||
      !(await this.flush()) ||
      this.mutating() ||
      epoch !== this.epoch
    )
      return false;
    const snapshot = this.current();
    if (!snapshot) return false;
    this.mutating.set(true);
    this.error.set('');
    let completed = false;
    this.mutation = (async () => {
      try {
        const saved = await firstValueFrom(command(snapshot));
        if (epoch !== this.epoch) return;
        // Notes can be edited while an explicit command is in flight. Keep those edits local.
        this.current.update((local) =>
          local && this.dirty
            ? {
                ...saved,
                title: local.title,
                objective: local.objective,
                notes: local.notes,
                items: saved.items.map((item) => ({
                  ...item,
                  notes: local.items.find((i) => i.id === item.id)?.notes ?? item.notes,
                })),
              }
            : saved,
        );
        if (!saved.items.some((i) => i.id === this.selectedItem()))
          this.selectItem(saved.items[0]?.id ?? null);
        this.status.set(this.dirty ? 'pending' : 'saved');
        await this.renderSources();
        completed = epoch === this.epoch;
      } catch (error) {
        if (epoch === this.epoch) this.fail(error);
      } finally {
        this.mutating.set(false);
      }
    })();
    await this.mutation;
    return completed;
  }
  async initializeTable() {
    const session = this.current(),
      epoch = this.epoch;
    if (!session || !(await this.flush()) || epoch !== this.epoch) return;
    await this.play.open(session.campaign, session.id);
  }
  moveTable(id: string, to: number) {
    if (!this.queueRunning() && !this.mutating()) this.play.move(id, to);
  }
  markUsed(id: string) {
    if (!this.queueRunning() && !this.mutating()) this.play.use(id);
  }
  returnToTable(id: string) {
    if (!this.queueRunning() && !this.mutating()) this.play.restore(id);
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.mutating()) {
      await this.mutation;
      return this.flush();
    }
    if (this.saving) {
      const waitingEpoch = this.epoch;
      if (!(await this.saving) || waitingEpoch !== this.epoch) return false;
      return this.dirty ? this.flush() : true;
    }
    const snapshot = this.current();
    if (!snapshot || !this.dirty) return true;
    const generation = this.generation,
      epoch = this.epoch;
    this.status.set('saving');
    this.error.set('');
    this.saving = (async () => {
      try {
        const saved = await firstValueFrom(
          this.api.saveSession(
            snapshot.campaign,
            snapshot.id,
            {
              revision: snapshot.revision,
              title: snapshot.title,
              objective: snapshot.objective,
              notes: snapshot.notes,
              items: snapshot.items.map((i) => ({ id: i.id, notes: i.notes })),
            },
            'body',
            false,
            { httpHeaderAccept: 'application/json' },
          ),
        );
        if (epoch !== this.epoch) return false;
        if (generation === this.generation) {
          this.current.set(saved);
          this.dirty = false;
          this.status.set('saved');
        } else {
          this.current.update((s) => (s ? { ...s, revision: saved.revision } : s));
          this.status.set('pending');
        }
        this.sessions.update((list) =>
          list.map((s) =>
            s.id === saved.id
              ? {
                  id: saved.id,
                  title: saved.title,
                  objective: saved.objective,
                  revision: saved.revision,
                }
              : s,
          ),
        );
        return true;
      } catch (e) {
        if (epoch === this.epoch) {
          this.status.set('failed');
          this.fail(e);
        }
        return false;
      } finally {
        if (epoch === this.epoch) this.saving = undefined;
      }
    })();
    const ok = await this.saving;
    return ok && this.dirty ? this.flush() : ok;
  }
  async startAdditions(capture: string, selections: SourceSelection[]) {
    const current = this.current();
    if (!current || this.queueRunning() || this.mutating() || !selections.length) return;
    this.queueIdentity = { campaign: current.campaign, session: current.id, capture };
    this.additions.set([
      ...new Map(
        selections.map((s) => [
          JSON.stringify([s.path, s.section]),
          { ...s, status: 'pending' as const },
        ]),
      ).values(),
    ]);
    await this.retryAdditions();
  }
  async retryAdditions() {
    const pin = this.queueIdentity,
      current = this.current();
    if (
      !pin ||
      !current ||
      this.queueRunning() ||
      this.mutating() ||
      current.campaign !== pin.campaign ||
      current.id !== pin.session
    )
      return;
    this.queueRunning.set(true);
    try {
      for (let index = 0; index < this.additions().length; index++) {
        const selection = this.additions()[index];
        if (selection.status === 'completed') continue;
        const ok = await this.addOne(pin.capture, selection.path, selection.section);
        this.additions.update((items) =>
          items.map((item, i) =>
            i === index ? { ...item, status: ok ? 'completed' : 'failed' } : item,
          ),
        );
        if (!ok) break;
      }
    } finally {
      this.queueRunning.set(false);
    }
  }
  async add(capture: string, path: string, section: string | null) {
    if (this.queueRunning()) return false;
    return this.addOne(capture, path, section);
  }
  async addDraft(draft: string, draftRevision: number): Promise<boolean> {
    if (this.queueRunning()) return false;
    return this.addOne('', '', null, { draft, draftRevision });
  }
  private async addOne(
    capture: string,
    path: string,
    section: string | null,
    authored?: { draft: string; draftRevision: number },
  ): Promise<boolean> {
    if (this.mutating() || !(await this.flush())) return false;
    if (this.mutating()) return false;
    const snapshot = this.current();
    if (!snapshot) {
      this.error.set('Create or open a session before adding source material.');
      return false;
    }
    const epoch = this.epoch;
    this.mutating.set(true);
    this.error.set('');
    let completed = false;
    this.mutation = (async () => {
      try {
        const json = { httpHeaderAccept: 'application/json' as const };
        const saved = await firstValueFrom(
          authored
            ? this.api.addSessionDraft(
                snapshot.campaign,
                snapshot.id,
                { revision: snapshot.revision, ...authored },
                'body',
                false,
                json,
              )
            : this.api.addSessionSource(
                snapshot.campaign,
                snapshot.id,
                { revision: snapshot.revision, capture, path, section },
                'body',
                false,
                json,
              ),
        );
        if (epoch !== this.epoch) return;
        const added = saved.items.filter((i) => !snapshot.items.some((old) => old.id === i.id));
        this.current.update((s) =>
          s
            ? {
                ...s,
                revision: saved.revision,
                items: [...s.items, ...added],
              }
            : s,
        );
        this.selectItem(added[0]?.id ?? null);
        this.status.set(this.dirty ? 'pending' : 'saved');
        await this.renderSources();
        if (epoch !== this.epoch) return;
        completed = true;
        this.notice.set(
          `${authored ? 'Approved draft revision' : 'Captured source'} added to ${this.current()?.title}. Its text is preserved with this session.`,
        );
      } catch (e) {
        if (epoch === this.epoch) this.fail(e);
      } finally {
        this.mutating.set(false);
      }
    })();
    await this.mutation;
    return completed;
  }
  async allowLeave(): Promise<boolean> {
    if (this.transferBusy() || this.mutating() || this.checkingRemoval() || this.queueRunning()) {
      this.error.set('Wait for the current operation to finish before leaving.');
      return false;
    }
    if (!(await this.play.allowLeave())) return false;
    if (!this.hasUnsaved() || (await this.flush())) return true;
    if (
      window.confirm(
        'Your edits have not been saved. Discard these local edits and leave? Cancel to stay and retry.',
      )
    ) {
      clearTimeout(this.timer);
      this.dirty = false;
      this.status.set('saved');
      return true;
    }
    return false;
  }
  async reload(): Promise<boolean> {
    if (this.queueRunning() || this.mutating()) return false;
    const s = this.current();
    if (!s) return false;
    if (this.hasUnsaved() && !window.confirm('Discard local edits and reload the saved session?'))
      return false;
    return this.open(s.campaign, s.id, true);
  }
  async export(campaign: string, ids: string[]) {
    if (this.transferBusy() || campaign !== this.activeCampaign) return;
    this.transferBusy.set(true);
    const epoch = this.epoch;
    try {
      if (
        !(await this.flush()) ||
        !(await this.play.flush()) ||
        epoch !== this.epoch ||
        campaign !== this.activeCampaign
      )
        return;
      const file = await firstValueFrom(
        this.portable.exportPortableSessions(campaign, { sessions: ids }, 'body', false, {
          httpHeaderAccept: 'application/zip',
        }),
      );
      if (epoch !== this.epoch || campaign !== this.activeCampaign) return;
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prepared-sessions.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.notice.set('Saved sessions exported.');
    } catch (e) {
      const detail = await transferError(e);
      if (epoch === this.epoch) this.error.set(detail);
    } finally {
      this.transferBusy.set(false);
    }
  }
  async import(campaign: string, file: File) {
    if (campaign !== this.activeCampaign || this.transferBusy()) return;
    const epoch = this.epoch;
    if (file.size > 256 * 1024 * 1024) {
      this.error.set('Archive exceeds 256 MiB.');
      return;
    }
    this.transferBusy.set(true);
    try {
      const result = await firstValueFrom(
        this.portable.importPortableSessions(campaign, file, 'body', false, {
          httpHeaderAccept: 'application/json',
        }),
      );
      if (epoch !== this.epoch || campaign !== this.activeCampaign) return;
      await this.list(campaign);
      if (epoch !== this.epoch || campaign !== this.activeCampaign) return;
      this.notice.set(
        `Imported ${result.sessions.length} new session(s). Existing sessions are preserved.`,
      );
    } catch (e) {
      const detail = await transferError(e);
      if (epoch === this.epoch && campaign === this.activeCampaign) {
        this.error.set(
          detail +
            ' Import result may be uncertain. Reload sessions before retrying; another import creates new sessions.',
        );
        await this.list(campaign);
      }
    } finally {
      this.transferBusy.set(false);
    }
  }
  private async renderSources() {
    const s = this.current(),
      epoch = this.epoch;
    if (!s) return;
    try {
      const view = await firstValueFrom(
        this.api.renderSession(s.campaign, s.id, 'body', false, {
          httpHeaderAccept: 'application/json',
        }),
      );
      if (epoch === this.epoch) this.rendered.set(view);
    } catch (e) {
      if (epoch === this.epoch) this.fail(e);
    }
  }
  private noteText(id: string): string | undefined {
    return id === 'session'
      ? this.current()?.notes
      : this.current()?.items.find((item) => item.id === id)?.notes;
  }
  private queuePreview(ids = ['session', ...(this.selectedItem() ? [this.selectedItem()!] : [])]) {
    for (const id of ids) {
      const text = this.noteText(id);
      if (text !== undefined && this.previewTexts.get(id) !== text) this.pendingPreviews.add(id);
    }
    if (!this.pendingPreviews.size) return;
    clearTimeout(this.previewTimer);
    const epoch = ++this.previewEpoch;
    this.previewTimer = setTimeout(() => void this.preview(epoch), 350);
  }
  private async preview(epoch: number) {
    const s = this.current();
    if (!s) return;
    const fields = [...this.pendingPreviews].flatMap((id) => {
      const text = this.noteText(id);
      if (text === undefined || this.previewTexts.get(id) === text) {
        this.pendingPreviews.delete(id);
        return [];
      }
      return [[id, text] as const];
    });
    try {
      const entries = await Promise.all(
        fields.map(async ([id, text]) => ({
          id,
          text,
          rendered: await firstValueFrom(
            this.api.previewMarkdown(s.campaign, { markdown: text }, 'body', false, {
              httpHeaderAccept: 'application/json',
            }),
          ),
        })),
      );
      if (
        epoch !== this.previewEpoch ||
        s.id !== this.current()?.id ||
        s.campaign !== this.current()?.campaign
      )
        return;
      const updates: Record<string, RenderedMarkdown> = {};
      for (const { id, text, rendered } of entries) {
        if (this.noteText(id) !== text) continue;
        this.previewTexts.set(id, text);
        this.pendingPreviews.delete(id);
        updates[id] = rendered;
      }
      this.previews.update((values) => ({ ...values, ...updates }));
    } catch (e) {
      if (epoch === this.previewEpoch) this.fail(e);
    }
  }
  private fail(e: unknown) {
    this.error.set(
      e instanceof HttpErrorResponse
        ? (e.error?.detail ?? 'Cannot reach the local backend.')
        : 'The operation failed. Check the file or retry.',
    );
  }
}
