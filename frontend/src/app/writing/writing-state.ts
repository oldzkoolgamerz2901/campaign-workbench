import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  WritingControllerService,
  ArtworkControllerService,
  DraftData,
  DraftFields,
  DraftPreview,
  AuthoringCatalog,
  ExportInspection,
  ExportSummary,
} from '../../api/generated';

@Injectable({ providedIn: 'root' })
export class WritingState {
  private readonly api = inject(WritingControllerService);
  private readonly artworkApi = inject(ArtworkControllerService);
  readonly pendingArtwork = signal<'keep' | 'replace' | 'remove'>('keep');
  readonly localArtwork = signal<string | null>(null);
  readonly artworkError = signal('');
  private artworkFile: File | null = null;
  private artworkChange = 0;
  private clearArtwork() {
    const url = this.localArtwork();
    if (url) URL.revokeObjectURL(url);
    this.localArtwork.set(null);
    this.artworkFile = null;
    this.pendingArtwork.set('keep');
    this.artworkError.set('');
  }
  selectArtwork(file: File) {
    if (!this.current() || this.deleting()) return;
    if (file.size > 10 * 1024 * 1024) {
      this.artworkError.set('Choose a JPEG, PNG or WebP file of at most 10 MiB.');
      return;
    }
    this.clearArtwork();
    this.artworkFile = file;
    this.localArtwork.set(URL.createObjectURL(file));
    this.pendingArtwork.set('replace');
    this.artworkChange++;
    this.edit({});
  }
  removeArtwork() {
    if (!this.current() || this.deleting()) return;
    this.clearArtwork();
    this.pendingArtwork.set('remove');
    this.artworkChange++;
    this.edit({});
  }
  private readonly json = { httpHeaderAccept: 'application/json' as const };
  readonly campaign = signal<string | null>(null);
  readonly drafts = signal<DraftData[]>([]);
  readonly current = signal<DraftData | null>(null);
  readonly catalog = signal<AuthoringCatalog | null>(null);
  readonly preview = signal<DraftPreview | null>(null);
  readonly status = signal<'saved' | 'dirty' | 'saving' | 'failed'>('saved');
  readonly loading = signal(false);
  readonly deleting = signal(false);
  readonly deleteFailed = signal(false);
  readonly notice = signal('');
  readonly error = signal('');
  readonly previewError = signal('');
  readonly group = signal('');
  readonly filterTag = signal('');
  readonly draftQuery = signal('');
  readonly conflict = signal(false);
  readonly inspection = signal<ExportInspection | null>(null);
  readonly artifacts = signal<ExportSummary[]>([]);
  readonly transferBusy = signal(false);
  readonly exportError = signal('');
  readonly exportNotice = signal('');
  private reportNumber = 0;
  private contextCapture: string | null | undefined;
  readonly filtered = computed(() =>
    this.drafts().filter(
      (d) =>
        (!this.group() || d.fields.type === this.group()) &&
        d.fields.title.toLowerCase().includes(this.draftQuery().trim().toLowerCase()) &&
        (!this.filterTag().trim() ||
          d.fields.tags.some(
            (t) => t.trim().toLowerCase() === this.filterTag().trim().toLowerCase(),
          )),
    ),
  );
  readonly tags = computed(() =>
    [
      ...new Set(
        this.drafts()
          .flatMap((d) => d.fields.tags)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ].sort(),
  );
  private generation = 0;
  private editNumber = 0;
  private previewNumber = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private previewTimer?: ReturnType<typeof setTimeout>;
  private saving?: Promise<boolean>;
  private persisted: DraftData | null = null;

  async selectCampaign(campaign: string) {
    if (this.deleting()) return;
    this.deleteFailed.set(false);
    this.notice.set('');
    this.invalidateExport();
    this.artifacts.set([]);
    const token = ++this.generation;
    this.clearTimers();
    this.clearArtwork();
    this.campaign.set(campaign);
    this.current.set(null);
    this.drafts.set([]);
    this.preview.set(null);
    this.error.set('');
    this.status.set('saved');
    this.conflict.set(false);
    this.loading.set(true);
    this.group.set('');
    this.filterTag.set('');
    this.draftQuery.set('');
    try {
      const list = await firstValueFrom(this.api.listDrafts(campaign, 'body', false, this.json));
      if (token !== this.generation) return;
      this.drafts.set(list.drafts);
      this.catalog.set(list.catalog);
    } catch (e) {
      if (token === this.generation) this.error.set(this.message(e));
    } finally {
      if (token === this.generation) this.loading.set(false);
    }
  }
  async open(id: string) {
    if (this.deleting()) return;
    const campaign = this.campaign(),
      origin = this.generation;
    if (!campaign) return;
    this.loading.set(true);
    if (!(await this.allowLeave())) {
      if (origin === this.generation) this.loading.set(false);
      return;
    }
    if (origin !== this.generation || campaign !== this.campaign()) return;
    const token = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const draft = await firstValueFrom(
        this.api.openDraft(campaign, id, 'body', false, this.json),
      );
      if (token !== this.generation) return;
      this.install(draft);
    } catch (e) {
      if (token === this.generation) this.error.set(this.message(e));
    } finally {
      if (token === this.generation) this.loading.set(false);
    }
  }
  async create(type: string, template: boolean) {
    if (this.deleting()) return;
    const campaign = this.campaign(),
      origin = this.generation;
    if (!campaign) return;
    this.loading.set(true);
    if (!(await this.allowLeave())) {
      if (origin === this.generation) this.loading.set(false);
      return;
    }
    if (origin !== this.generation || campaign !== this.campaign()) return;
    const token = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const draft = await firstValueFrom(
        this.api.createDraft(campaign, { type, template }, 'body', false, this.json),
      );
      if (token !== this.generation) return;
      this.drafts.update((ds) => [...ds, draft]);
      this.group.set(type);
      this.filterTag.set('');
      this.draftQuery.set('');
      this.install(draft);
    } catch (e) {
      if (token === this.generation) this.error.set(this.message(e));
    } finally {
      if (token === this.generation) this.loading.set(false);
    }
  }
  private install(draft: DraftData) {
    this.deleteFailed.set(false);
    this.notice.set('');
    this.invalidateExport();
    this.artifacts.set([]);
    this.exportError.set('');
    this.exportNotice.set('');
    this.clearArtwork();
    this.persisted = draft;
    this.current.set(draft);
    this.drafts.update((ds) => ds.map((d) => (d.id === draft.id ? draft : d)));
    this.status.set('saved');
    this.conflict.set(false);
    this.error.set('');
    this.editNumber = 0;
    this.preview.set(null);
    this.schedulePreview();
    void this.loadHistory(draft);
  }
  edit(change: Partial<DraftFields>) {
    if (this.deleting()) return;
    const d = this.current();
    if (!d) return;
    this.invalidateExport();
    const after = { ...d, fields: { ...d.fields, ...change } };
    this.current.set(after);
    this.drafts.update((ds) => ds.map((v) => (v.id === after.id ? after : v)));
    this.editNumber++;
    if (!this.conflict() && !this.deleteFailed()) this.status.set('dirty');
    clearTimeout(this.timer);
    if (!this.conflict() && !this.deleteFailed())
      this.timer = setTimeout(() => void this.flush(), 500);
    this.schedulePreview();
  }
  flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.deleting() || this.deleteFailed()) return Promise.resolve(false);
    if (this.saving) return this.saving;
    if (this.conflict()) return Promise.resolve(false);
    if (!this.current() || this.status() === 'saved') return Promise.resolve(true);
    const token = this.generation;
    this.saving = this.saveLoop(token).finally(() => {
      this.saving = undefined;
    });
    return this.saving;
  }
  private async saveLoop(token: number) {
    while (token === this.generation && !this.deleting() && !this.deleteFailed()) {
      const draft = this.current();
      if (!draft) return true;
      const edit = this.editNumber;
      this.status.set('saving');
      this.error.set('');
      try {
        const imageChange = this.artworkChange;
        const imageAction = this.pendingArtwork();
        const metadata = { revision: draft.revision, fields: draft.fields, imageAction };
        const saved = await firstValueFrom(
          imageAction === 'replace' && this.artworkFile
            ? this.artworkApi.replaceDraftArtwork(
                draft.campaign,
                draft.id,
                JSON.stringify(metadata),
                this.artworkFile,
                'body',
                false,
                this.json,
              )
            : this.api.saveDraft(draft.campaign, draft.id, metadata, 'body', false, this.json),
        );
        if (token !== this.generation || this.current()?.id !== draft.id) return false;
        this.persisted = saved;
        if (imageChange === this.artworkChange) this.clearArtwork();
        this.current.update((d) =>
          d ? { ...d, revision: saved.revision, image: saved.image } : d,
        );
        this.drafts.update((ds) =>
          ds.map((d) =>
            d.id === saved.id ? { ...d, revision: saved.revision, image: saved.image } : d,
          ),
        );
        if (edit === this.editNumber) {
          this.status.set('saved');
          return true;
        }
        this.status.set('dirty');
      } catch (e) {
        if (token === this.generation) {
          this.status.set('failed');
          this.error.set(this.message(e));
          this.conflict.set(e instanceof HttpErrorResponse && e.status === 409);
        }
        return false;
      }
    }
    return false;
  }
  async deleteCurrent(): Promise<boolean> {
    const draft = this.current(),
      token = this.generation;
    if (!draft || this.deleting() || this.loading() || this.transferBusy() || this.conflict())
      return false;
    const title = draft.fields.title || 'Untitled draft';
    if (
      !window.confirm(
        `Delete “${title}”? The working draft and unsaved edits will be permanently deleted. Retained exports, approved revisions, prepared session copies and campaign files stay unchanged. There is no undo.`,
      )
    )
      return false;
    this.deleting.set(true);
    this.notice.set('');
    this.clearTimers();
    this.invalidateExport();
    try {
      // A save already sent may advance the acknowledged revision. Never flush further local edits.
      if (this.saving) await this.saving;
      if (token !== this.generation || this.current()?.id !== draft.id) return false;
      if (this.conflict()) {
        this.deleteFailed.set(true);
        this.status.set('failed');
        return false;
      }
      await firstValueFrom(
        this.api.deleteDraft(draft.campaign, draft.id, this.current()!.revision),
      );
      if (token !== this.generation || this.current()?.id !== draft.id) return false;
      this.generation++;
      this.clearTimers();
      this.invalidateExport();
      this.drafts.update((ds) => ds.filter((d) => d.id !== draft.id));
      this.clearArtwork();
      this.current.set(null);
      this.persisted = null;
      this.preview.set(null);
      this.previewError.set('');
      this.artifacts.set([]);
      this.exportError.set('');
      this.exportNotice.set('');
      this.error.set('');
      this.conflict.set(false);
      this.deleteFailed.set(false);
      this.status.set('saved');
      this.notice.set(`Deleted “${title}”. Retained history and prepared copies are unchanged.`);
      return true;
    } catch (e) {
      if (token === this.generation && this.current()?.id === draft.id) {
        this.deleteFailed.set(true);
        this.status.set('failed');
        this.conflict.set(e instanceof HttpErrorResponse && e.status === 409);
        this.error.set(
          `Deletion was not confirmed. ${this.message(e)} Local edits are retained; retry deletion or explicitly reload/discard. Automatic saving is paused.`,
        );
      }
      return false;
    } finally {
      this.deleting.set(false);
    }
  }
  async reload() {
    if (this.deleting()) return;
    const draft = this.current();
    if (!draft || !window.confirm('Discard local draft edits and reload the saved version?'))
      return;
    this.clearTimers();
    const token = ++this.generation;
    this.loading.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.openDraft(draft.campaign, draft.id, 'body', false, this.json),
      );
      if (token === this.generation) this.install(saved);
    } catch (e) {
      if (token === this.generation) {
        this.status.set('failed');
        this.error.set(this.message(e));
      }
    } finally {
      if (token === this.generation) this.loading.set(false);
    }
  }
  async allowLeave() {
    if (this.deleting()) return false;
    if (await this.flush()) return true;
    if (!window.confirm('Your draft has unsaved changes. Discard local edits and leave?'))
      return false;
    this.clearTimers();
    const saved = this.persisted;
    if (saved) this.drafts.update((ds) => ds.map((d) => (d.id === saved.id ? saved : d)));
    this.status.set('saved');
    this.conflict.set(false);
    this.deleteFailed.set(false);
    this.clearArtwork();
    this.generation++;
    this.current.set(null);
    return true;
  }
  deactivate() {
    this.clearArtwork();
    this.deleteFailed.set(false);
    this.invalidateExport();
    this.generation++;
    this.previewNumber++;
    this.clearTimers();
    this.current.set(null);
    this.campaign.set(null);
    this.status.set('saved');
  }
  private clearTimers() {
    clearTimeout(this.timer);
    clearTimeout(this.previewTimer);
    this.previewNumber++;
  }
  private schedulePreview() {
    if (this.deleting()) return;
    clearTimeout(this.previewTimer);
    const request = ++this.previewNumber;
    this.previewTimer = setTimeout(() => void this.loadPreview(request), 200);
  }
  private async loadPreview(request: number) {
    const draft = this.current();
    if (!draft) return;
    const token = this.generation;
    this.previewError.set('');
    try {
      const result = await firstValueFrom(
        this.api.previewDraft(draft.campaign, draft.id, draft.fields, 'body', false, this.json),
      );
      if (token === this.generation && request === this.previewNumber) this.preview.set(result);
    } catch (e) {
      if (token === this.generation && request === this.previewNumber) {
        this.preview.set(null);
        this.previewError.set(this.message(e));
      }
    }
  }
  private message(e: unknown) {
    return e instanceof HttpErrorResponse
      ? (e.error?.detail ?? 'Cannot reach the local backend. Your working edits are retained.')
      : 'Operation failed. Please retry.';
  }

  contextChanged(capture: string | null | undefined) {
    if (capture !== this.contextCapture) {
      this.contextCapture = capture;
      this.invalidateExport();
    }
  }
  recheckPreview() {
    this.schedulePreview();
  }
  private invalidateExport() {
    this.reportNumber++;
    this.inspection.set(null);
  }
  async fork(capture: string, path: string, type: string | null) {
    if (this.deleting()) return false;
    const campaign = this.campaign(),
      origin = this.generation;
    if (!campaign) return false;
    this.loading.set(true);
    if (!(await this.allowLeave())) {
      if (origin === this.generation) this.loading.set(false);
      return false;
    }
    if (origin !== this.generation || campaign !== this.campaign()) return false;
    const token = ++this.generation;
    this.error.set('');
    try {
      const draft = await firstValueFrom(
        this.api.forkDraft(campaign, { capture, path, type }, 'body', false, this.json),
      );
      if (token !== this.generation) return false;
      this.drafts.update((ds) => [...ds, draft]);
      this.group.set(draft.fields.type);
      this.filterTag.set('');
      this.draftQuery.set('');
      this.install(draft);
      return true;
    } catch (e) {
      if (token === this.generation) this.error.set(this.message(e));
      return false;
    } finally {
      if (token === this.generation) this.loading.set(false);
    }
  }
  async inspectExport(capture: string | null) {
    const original = this.current(),
      token = this.generation;
    if (!original || this.transferBusy() || this.deleting() || this.deleteFailed()) return;
    this.transferBusy.set(true);
    this.exportError.set('');
    this.exportNotice.set('');
    try {
      if (!(await this.flush()) || token !== this.generation || this.current()?.id !== original.id)
        return;
      const draft = this.current()!,
        edit = this.editNumber,
        report = ++this.reportNumber;
      this.inspection.set(null);
      const checked = await firstValueFrom(
        this.api.inspectDraftExport(
          draft.campaign,
          draft.id,
          { revision: draft.revision, capture },
          'body',
          false,
          this.json,
        ),
      );
      if (token === this.generation && edit === this.editNumber && report === this.reportNumber)
        this.inspection.set(checked);
    } catch (e) {
      if (token === this.generation) this.exportError.set(this.message(e));
    } finally {
      this.transferBusy.set(false);
    }
  }
  async prepareExport(acknowledgeWarnings: boolean) {
    const draft = this.current(),
      checked = this.inspection(),
      token = this.generation,
      report = this.reportNumber;
    if (
      !draft ||
      !checked ||
      this.transferBusy() ||
      this.deleting() ||
      this.deleteFailed() ||
      this.status() !== 'saved'
    )
      return;
    this.transferBusy.set(true);
    this.exportError.set('');
    this.exportNotice.set('');
    try {
      const artifact = await firstValueFrom(
        this.api.createDraftExport(
          draft.campaign,
          draft.id,
          {
            revision: checked.revision,
            capture: checked.capture,
            fingerprint: checked.fingerprint,
            acknowledgeWarnings,
          },
          'body',
          false,
          this.json,
        ),
      );
      if (token !== this.generation || report !== this.reportNumber) return;
      await this.loadHistory(draft);
      await this.download(artifact.id, checked.path, draft);
    } catch (e) {
      if (token === this.generation) {
        this.exportError.set(this.message(e));
        if (e instanceof HttpErrorResponse && e.status === 409) this.invalidateExport();
      }
    } finally {
      this.transferBusy.set(false);
    }
  }
  async loadHistory(draft = this.current()) {
    if (!draft) return;
    const token = this.generation;
    try {
      const history = await firstValueFrom(
        this.api.listDraftExports(draft.campaign, draft.id, 'body', false, this.json),
      );
      if (token === this.generation && draft.id === this.current()?.id)
        this.artifacts.set(history.artifacts);
    } catch (e) {
      if (token === this.generation && draft.id === this.current()?.id)
        this.exportError.set(this.message(e));
    }
  }
  async download(artifact: string, path: string, draft = this.current()) {
    if (!draft) return;
    const token = this.generation;
    try {
      const blob = await firstValueFrom(
        this.api.downloadDraftExport(draft.campaign, draft.id, artifact, 'body', false, {
          httpHeaderAccept: 'text/markdown',
        }),
      );
      if (token !== this.generation || this.current()?.id !== draft.id) return;
      const url = URL.createObjectURL(blob),
        anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = path.split('/').pop() || 'draft.md';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.exportNotice.set(
        `Download requested. Place the file at ${path} manually; no campaign file was changed.`,
      );
    } catch {
      if (token === this.generation)
        this.exportError.set(
          'Download failed. The saved artifact remains available in Export history; try downloading it again.',
        );
    }
  }
}
