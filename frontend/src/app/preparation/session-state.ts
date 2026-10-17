import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  PreparationControllerService,
  SessionData,
  SessionSummary,
  RenderedMarkdown,
  SessionView,
  Archive,
} from '../../api/generated';

@Injectable({ providedIn: 'root' })
export class SessionState {
  private readonly api = inject(PreparationControllerService);
  readonly sessions = signal<SessionSummary[]>([]);
  readonly current = signal<SessionData | null>(null);
  readonly selectedItem = signal<string | null>(null);
  readonly status = signal<'saved' | 'pending' | 'saving' | 'failed'>('saved');
  readonly error = signal('');
  readonly notice = signal('');
  readonly rendered = signal<SessionView | null>(null);
  readonly previews = signal<Record<string, RenderedMarkdown>>({});
  readonly mutating = signal(false);
  readonly loading = signal(false);
  private activeCampaign: string | null = null;
  private generation = 0;
  private epoch = 0;
  private listEpoch = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private previewTimer?: ReturnType<typeof setTimeout>;
  private previewEpoch = 0;
  private dirty = false;
  private saving?: Promise<boolean>;
  private mutation?: Promise<void>;

  hasUnsaved() {
    return this.dirty || !!this.saving || this.mutating();
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
  async open(campaign: string, id: string) {
    this.bindCampaign(campaign);
    if (this.current()?.id === id && this.current()?.campaign === campaign) return;
    const epoch = ++this.epoch;
    this.previewEpoch++;
    this.notice.set('');
    this.loading.set(true);
    this.current.set(null);
    this.rendered.set(null);
    this.previews.set({});
    this.dirty = false;
    this.error.set('');
    this.status.set('saved');
    clearTimeout(this.timer);
    try {
      const s = await firstValueFrom(
        this.api.openSession(campaign, id, 'body', false, { httpHeaderAccept: 'application/json' }),
      );
      if (epoch !== this.epoch) return;
      this.current.set(s);
      this.selectedItem.set(s.items[0]?.id ?? null);
      await this.renderSources();
      this.queuePreview();
    } catch (e) {
      if (epoch === this.epoch) this.fail(e);
    } finally {
      if (epoch === this.epoch) this.loading.set(false);
    }
  }
  clear() {
    this.epoch++;
    this.listEpoch++;
    this.previewEpoch++;
    this.current.set(null);
    this.loading.set(false);
    this.notice.set('');
    this.sessions.set([]);
    this.rendered.set(null);
    this.previews.set({});
    clearTimeout(this.timer);
    clearTimeout(this.previewTimer);
    this.dirty = false;
    this.status.set('saved');
    this.error.set('');
    this.selectedItem.set(null);
  }
  edit(change: Partial<Pick<SessionData, 'title' | 'objective' | 'notes' | 'items'>>) {
    if (!this.current()) return;
    this.current.update((s) => (s ? { ...s, ...change } : s));
    this.generation++;
    this.dirty = true;
    // A failed save stays explicit until Retry, Reload, or Discard; further edits remain local.
    if (this.status() !== 'failed') {
      this.status.set(this.saving ? 'saving' : 'pending');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush(), 500);
    }
    this.queuePreview();
  }
  editItemNotes(id: string, notes: string) {
    this.edit({ items: this.current()!.items.map((i) => (i.id === id ? { ...i, notes } : i)) });
  }
  move(id: string, delta: number) {
    const items = [...(this.current()?.items ?? [])],
      from = items.findIndex((i) => i.id === id),
      to = from + delta;
    if (from < 0 || to < 0 || to >= items.length) return;
    [items[from], items[to]] = [items[to], items[from]];
    this.edit({ items });
  }
  remove(id: string) {
    const items = this.current()!.items.filter((i) => i.id !== id);
    this.edit({ items });
    if (this.selectedItem() === id) this.selectedItem.set(items[0]?.id ?? null);
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.mutating()) {
      await this.mutation;
      return this.flush();
    }
    if (this.saving) {
      if (!(await this.saving)) return false;
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
        this.saving = undefined;
      }
    })();
    const ok = await this.saving;
    return ok && this.dirty ? this.flush() : ok;
  }
  async add(capture: string, path: string, section: string | null) {
    if (this.mutating() || !(await this.flush())) return;
    if (this.mutating()) return;
    const snapshot = this.current();
    if (!snapshot) {
      this.error.set('Create or open a session before adding source material.');
      return;
    }
    const epoch = this.epoch;
    this.mutating.set(true);
    this.error.set('');
    this.mutation = (async () => {
      try {
        const saved = await firstValueFrom(
          this.api.addSessionSource(
            snapshot.campaign,
            snapshot.id,
            { revision: snapshot.revision, capture, path, section },
            'body',
            false,
            { httpHeaderAccept: 'application/json' },
          ),
        );
        if (epoch !== this.epoch) return;
        const added = saved.items.filter((i) => !snapshot.items.some((old) => old.id === i.id));
        this.current.update((s) =>
          s ? { ...s, revision: saved.revision, items: [...s.items, ...added] } : s,
        );
        this.selectedItem.set(added[0]?.id ?? null);
        this.status.set(this.dirty ? 'pending' : 'saved');
        await this.renderSources();
        this.notice.set('Captured source added. Its text is preserved with this session.');
      } catch (e) {
        if (epoch === this.epoch) this.fail(e);
      } finally {
        this.mutating.set(false);
      }
    })();
    await this.mutation;
  }
  async allowLeave(): Promise<boolean> {
    if (this.mutating()) {
      this.error.set('Wait for the source capture to finish before leaving.');
      return false;
    }
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
  async reload() {
    const s = this.current();
    if (!s) return;
    if (this.hasUnsaved() && !window.confirm('Discard local edits and reload the saved session?'))
      return;
    this.current.set(null);
    await this.open(s.campaign, s.id);
  }
  async export(campaign: string, ids: string[]) {
    if (!(await this.flush())) return;
    try {
      const archive = await firstValueFrom(
        this.api.exportSessions(campaign, { sessions: ids }, 'body', false, {
          httpHeaderAccept: 'application/json',
        }),
      );
      const file = new Blob([JSON.stringify(archive)], { type: 'application/json' });
      if (file.size > 20 * 1024 * 1024) {
        this.error.set('Archive exceeds 20 MiB; select fewer sessions.');
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prepared-sessions.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.notice.set('Saved sessions exported.');
    } catch (e) {
      this.fail(e);
    }
  }
  async import(campaign: string, file: File) {
    const epoch = this.epoch;
    if (file.size > 20 * 1024 * 1024) {
      this.error.set('Archive exceeds 20 MiB.');
      return;
    }
    try {
      const archive = JSON.parse(await file.text()) as Archive;
      // Generated API binding is used after the file adapter reads the archive.
      const result = await firstValueFrom(
        this.api.importSessions(campaign, archive, 'body', false, {
          httpHeaderAccept: 'application/json',
        }),
      );
      if (epoch !== this.epoch || campaign !== this.activeCampaign) return;
      await this.list(campaign);
      this.notice.set(
        `Imported ${result.sessions.length} new session(s). Existing sessions are preserved.`,
      );
    } catch (e) {
      if (epoch === this.epoch && campaign === this.activeCampaign) this.fail(e);
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
  private queuePreview() {
    clearTimeout(this.previewTimer);
    const epoch = ++this.previewEpoch;
    this.previewTimer = setTimeout(() => void this.preview(epoch), 350);
  }
  private async preview(epoch: number) {
    const s = this.current();
    if (!s) return;
    const fields = [['session', s.notes], ...s.items.map((i) => [i.id, i.notes])];
    try {
      const entries = await Promise.all(
        fields.map(
          async ([id, text]) =>
            [
              id,
              await firstValueFrom(
                this.api.previewMarkdown(s.campaign, { markdown: text }, 'body', false, {
                  httpHeaderAccept: 'application/json',
                }),
              ),
            ] as const,
        ),
      );
      if (epoch === this.previewEpoch && s.id === this.current()?.id)
        this.previews.set(Object.fromEntries(entries));
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
