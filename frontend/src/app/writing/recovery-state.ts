import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  RecoveryControllerService,
  PortableWritingControllerService,
  RecoverySummary,
  RecoveryIndex,
  RecoveryDetail,
  DraftData,
} from '../../api/generated';
import { transferError } from '../shared/transfer-error';
import { WritingState } from './writing-state';

@Injectable({ providedIn: 'root' })
export class RecoveryState {
  private readonly api = inject(RecoveryControllerService);
  private readonly portable = inject(PortableWritingControllerService);
  private readonly writing = inject(WritingState);
  private readonly json = { httpHeaderAccept: 'application/json' as const };
  readonly workspaces = signal<RecoverySummary[]>([]);
  readonly index = signal<RecoveryIndex | null>(null);
  readonly detail = signal<RecoveryDetail | null>(null);
  readonly copied = signal<DraftData | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly group = signal('All');
  readonly kind = signal('draft');
  readonly records = computed(() =>
    (this.index()?.records ?? []).filter(
      (r) => r.kind === this.kind() && (this.group() === 'All' || r.type === this.group()),
    ),
  );
  private epoch = 0;
  private selection = 0;
  deactivate() {
    this.epoch++;
    this.selection++;
  }
  async load() {
    const epoch = ++this.epoch;
    try {
      const list = await firstValueFrom(this.api.listRecoveryWorkspaces('body', false, this.json));
      if (epoch === this.epoch) this.workspaces.set(list.workspaces);
    } catch {
      if (epoch === this.epoch) this.error.set('Cannot load recovery workspaces. Retry reload.');
    }
  }
  async open(id: string) {
    if (this.busy()) return;
    await this.openWorkspace(id);
  }
  private async openWorkspace(id: string) {
    const epoch = ++this.epoch;
    this.selection++;
    this.index.set(null);
    this.detail.set(null);
    this.copied.set(null);
    this.error.set('');
    try {
      const index = await firstValueFrom(
        this.api.getRecoveryWorkspace(id, 'body', false, this.json),
      );
      if (epoch === this.epoch) {
        this.index.set(index);
        this.kind.set('draft');
        this.group.set('All');
      }
    } catch {
      if (epoch === this.epoch) this.error.set('Cannot open recovery workspace. Retry selection.');
    }
  }
  async select(key: string) {
    if (this.busy()) return;
    const id = this.index()?.workspace.id,
      epoch = this.epoch,
      selection = ++this.selection;
    if (!id) return;
    this.detail.set(null);
    this.copied.set(null);
    this.error.set('');
    try {
      const detail = await firstValueFrom(
        this.api.getRecoveryRecord(id, key, 'body', false, this.json),
      );
      if (epoch === this.epoch && selection === this.selection) this.detail.set(detail);
    } catch {
      if (epoch === this.epoch && selection === this.selection)
        this.error.set('Cannot read this record. Select it again to retry.');
    }
  }
  async restore(file: File) {
    if (this.busy()) return;
    if (file.size > 256 * 1024 * 1024) {
      this.error.set('Archive exceeds 256 MiB. No workspace created.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const epoch = this.epoch;
    try {
      const saved = await firstValueFrom(
        this.portable.restorePortableWritingArchive(file, 'body', false, this.json),
      );
      if (epoch !== this.epoch) return;
      this.notice.set('Recovery workspace saved. Original work is unchanged.');
      await this.load();
      await this.openWorkspace(saved.id);
    } catch (e) {
      const detail = await transferError(e);
      if (epoch === this.epoch) {
        this.error.set(
          detail +
            ' Restore failed or its result is uncertain. Reload workspaces before retrying; another upload creates a separate workspace.',
        );
        await this.load();
      }
    } finally {
      this.busy.set(false);
    }
  }
  async copy(campaign: string) {
    const d = this.detail(),
      id = this.index()?.workspace.id;
    if (this.busy() || !campaign || !d || !id || d.record.kind !== 'draft') return;
    this.busy.set(true);
    this.error.set('');
    this.copied.set(null);
    const epoch = this.epoch,
      selection = this.selection;
    try {
      const copied = await firstValueFrom(
        this.api.copyRecoveredDraft(
          id,
          { draft: d.snapshot.id, campaign },
          'body',
          false,
          this.json,
        ),
      );
      if (epoch === this.epoch && selection === this.selection) {
        this.copied.set(copied);
        this.notice.set(
          'New draft saved in the selected campaign. Session approval is still required.',
        );
      }
    } catch {
      if (epoch === this.epoch)
        this.error.set(
          'Copy failed or its result is uncertain. Check destination drafts before retrying; another copy creates a new draft.',
        );
    } finally {
      this.busy.set(false);
    }
  }
  async backup(campaign: string) {
    if (!campaign || this.busy()) return;
    await this.download(async () => {
      if (this.writing.campaign() === campaign && !(await this.writing.flush()))
        throw new Error('save');
      return firstValueFrom(
        this.portable.downloadPortableWritingArchive(campaign, 'body', false, {
          httpHeaderAccept: 'application/zip',
        }),
      );
    }, 'writing-recovery.zip');
  }
  async reexport() {
    const id = this.index()?.workspace.id;
    if (id)
      await this.download(
        () =>
          firstValueFrom(
            this.portable.downloadPortableRecoveredArchive(id, 'body', false, {
              httpHeaderAccept: 'application/zip',
            }),
          ),
        'recovered-writing.zip',
      );
  }
  async markdown() {
    const id = this.index()?.workspace.id,
      d = this.detail();
    if (id && d?.record.kind === 'export')
      await this.download(
        () =>
          firstValueFrom(
            this.api.downloadRecoveredMarkdown(id, d.record.key, 'body', false, {
              httpHeaderAccept: 'text/markdown',
            }),
          ),
        'recovered-export.md',
      );
  }
  private async download(request: () => Promise<Blob>, name: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const epoch = this.epoch;
    try {
      const blob = await request();
      if (epoch !== this.epoch) return;
      const url = URL.createObjectURL(blob),
        anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const detail = await transferError(e);
      if (epoch === this.epoch)
        this.error.set(
          'Download failed. ' +
            detail +
            ' Check save state and retry; recovery records remain available.',
        );
    } finally {
      this.busy.set(false);
    }
  }
}
