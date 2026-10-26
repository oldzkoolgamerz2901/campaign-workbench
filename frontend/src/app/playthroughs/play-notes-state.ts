import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  PlayNoteControllerService,
  PlayNoteData,
  CreatePlayNote,
  EditPlayNote,
} from '../../api/generated';
import { PlayWorkspaceState } from './workspace-state';

// Instant responses use canonical UTC. Pad fractional seconds so retries and imported
// timestamp ties retain server chronology without losing sub-millisecond precision.
function chronological(a: PlayNoteData, b: PlayNoteData) {
  const key = (value: string) =>
    value.replace(
      /(\.\d+)?Z$/,
      (_, fraction: string | undefined) => '.' + (fraction?.slice(1) ?? '').padEnd(9, '0') + 'Z',
    );
  const year = (value: string) => Number(value.match(/^[+-]?\d+/)?.[0]);
  return (
    year(b.createdAt) - year(a.createdAt) ||
    key(b.createdAt).localeCompare(key(a.createdAt)) ||
    b.id.localeCompare(a.id)
  );
}
const options = { httpHeaderAccept: 'application/json' as const };
@Injectable({ providedIn: 'root' })
export class PlayNotesState {
  private readonly api = inject(PlayNoteControllerService);
  private readonly play = inject(PlayWorkspaceState);
  readonly notes = signal<PlayNoteData[]>([]);
  readonly text = signal('');
  readonly resource = signal<string | null>(null);
  readonly expectedScene = signal<string | null>(null);
  readonly sceneTitle = signal('No active Scene');
  readonly editing = signal<PlayNoteData | null>(null);
  readonly pinned = signal(false);
  readonly changeResource = signal(false);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly status = signal<'saved' | 'pending' | 'saving' | 'failed'>('saved');
  readonly contextConflict = signal(false);
  readonly uncertain = signal(false);
  private campaign = '';
  private session = '';
  private epoch = 0;
  private historyEpoch = 0;
  private started = false;
  private creation?: CreatePlayNote;
  private editRequest?: { id: string; body: EditPlayNote };
  private saving?: Promise<boolean>;
  ready(campaign: string, session: string) {
    return (
      !this.loading() &&
      this.campaign === campaign &&
      this.session === session &&
      this.play.current()?.session === session
    );
  }
  hasUnsaved() {
    return this.status() !== 'saved' || this.busy();
  }
  clear() {
    this.epoch++;
    this.historyEpoch++;
    this.campaign = this.session = '';
    this.notes.set([]);
    this.loading.set(false);
    this.busy.set(false);
    this.saving = undefined;
    this.resetDraft();
  }
  private resetDraft() {
    this.text.set('');
    this.resource.set(null);
    this.expectedScene.set(null);
    this.sceneTitle.set('No active Scene');
    this.editing.set(null);
    this.pinned.set(false);
    this.changeResource.set(false);
    this.status.set('saved');
    this.error.set('');
    this.contextConflict.set(false);
    this.uncertain.set(false);
    this.started = false;
    this.creation = undefined;
    this.editRequest = undefined;
  }
  async open(campaign: string, session: string) {
    if (this.campaign === campaign && this.session === session) return;
    this.clear();
    this.campaign = campaign;
    this.session = session;
    await this.reloadHistory();
  }
  async reloadHistory() {
    const epoch = this.epoch;
    if (!this.campaign || this.loading()) return;
    const history = ++this.historyEpoch;
    this.loading.set(true);
    try {
      const result = await firstValueFrom(
        this.api.listPlayNotes(this.campaign, this.session, 'body', false, options),
      );
      if (epoch === this.epoch && history === this.historyEpoch) this.notes.set(result.notes);
    } catch (e) {
      if (epoch === this.epoch && history === this.historyEpoch) this.error.set(this.message(e));
    } finally {
      if (epoch === this.epoch && history === this.historyEpoch) this.loading.set(false);
    }
  }
  private begin(title: string) {
    if (this.started || this.editing()) return;
    this.started = true;
    this.expectedScene.set(this.play.current()?.activeSceneItemId ?? null);
    this.sceneTitle.set(title);
  }
  setText(text: string, title: string) {
    if (this.busy() || this.creation || this.editRequest) return;
    this.begin(title);
    this.text.set(text);
    this.changed();
  }
  setResource(resource: string | null, title: string) {
    if (this.busy() || this.creation || this.editRequest) return;
    this.begin(title);
    this.resource.set(resource);
    this.changeResource.set(true);
    this.changed();
  }
  setPinned(value: boolean) {
    if (!this.busy() && !this.editRequest) {
      this.pinned.set(value);
      this.changed();
    }
  }
  private changed() {
    this.status.set('pending');
    this.error.set('');
  }
  locked() {
    return this.busy() || !!this.creation || !!this.editRequest;
  }
  select(note: PlayNoteData) {
    if (
      this.busy() ||
      (this.hasUnsaved() && !window.confirm('Discard local PlayNote edits and open this note?'))
    )
      return;
    this.resetDraft();
    this.editing.set(note);
    this.text.set(note.markdown);
    this.pinned.set(note.pinned);
    this.expectedScene.set(null);
    this.sceneTitle.set(note.scene?.title ?? 'No captured Scene');
  }
  discard() {
    if (
      this.busy() ||
      (this.hasUnsaved() &&
        !window.confirm(
          'Discard this local PlayNote draft? A dispatched capture may already be saved; reload history to check.',
        ))
    )
      return;
    this.resetDraft();
    void this.reloadHistory();
  }
  async useCurrentScene(title: (id: string | null) => string) {
    if (this.busy() || !this.contextConflict()) return;
    const epoch = this.epoch;
    await this.play.open(this.campaign, this.session);
    if (epoch !== this.epoch || !this.play.current()) return;
    this.creation = undefined;
    this.contextConflict.set(false);
    this.expectedScene.set(this.play.current()!.activeSceneItemId);
    this.sceneTitle.set(title(this.expectedScene()));
    this.status.set('pending');
    this.error.set('');
  }
  async reloadEdited() {
    const selected = this.editing();
    const epoch = this.epoch;
    await this.reloadHistory();
    if (epoch !== this.epoch || !selected) return;
    const current = this.notes().find((n) => n.id === selected.id);
    if (
      current &&
      window.confirm(
        'Use the latest saved note revision? Your local text and chosen correction will remain for review.',
      )
    ) {
      this.editing.set(current);
      this.editRequest = undefined;
      this.uncertain.set(false);
      this.status.set('pending');
      this.error.set('');
    }
  }
  save(): Promise<boolean> {
    if (this.saving) return this.saving;
    if (!this.campaign || !this.text().trim() || this.contextConflict())
      return Promise.resolve(false);
    const epoch = this.epoch,
      campaign = this.campaign,
      session = this.session;
    if (this.editing())
      this.editRequest ??= {
        id: this.editing()!.id,
        body: {
          revision: this.editing()!.revision,
          markdown: this.text(),
          pinned: this.pinned(),
          changeResource: this.changeResource(),
          resource: this.resource(),
        },
      };
    else
      this.creation ??= {
        operation: crypto.randomUUID(),
        expectedScene: this.expectedScene(),
        markdown: this.text(),
        resource: this.resource(),
      };
    this.busy.set(true);
    this.status.set('saving');
    this.error.set('');
    const request = this.editRequest;
    const operation = Promise.resolve().then(async () => {
      try {
        const saved = await firstValueFrom(
          request
            ? this.api.editPlayNote(
                campaign,
                session,
                request.id,
                request.body,
                'body',
                false,
                options,
              )
            : this.api.createPlayNote(campaign, session, this.creation!, 'body', false, options),
        );
        if (epoch !== this.epoch) return false;
        this.historyEpoch++;
        this.loading.set(false);
        this.notes.update((notes) =>
          notes.some((n) => n.id === saved.id)
            ? notes.map((n) => (n.id === saved.id ? saved : n))
            : [saved, ...notes].sort(chronological),
        );
        this.resetDraft();
        return true;
      } catch (e) {
        if (epoch === this.epoch) {
          this.status.set('failed');
          this.error.set(this.message(e));
          this.contextConflict.set(
            e instanceof HttpErrorResponse && e.error?.code === 'playnotes.scene-context',
          );
          // Unknown delivery retains the exact request, including its operation/revision.
          this.uncertain.set(
            !(e instanceof HttpErrorResponse) || e.status === 0 || e.status >= 500,
          );
          if (
            e instanceof HttpErrorResponse &&
            e.status >= 400 &&
            e.status < 500 &&
            !this.contextConflict() &&
            !request
          )
            this.creation = undefined;
        }
        return false;
      } finally {
        if (epoch === this.epoch) {
          this.busy.set(false);
          this.saving = undefined;
        }
      }
    });
    this.saving = operation;
    return operation;
  }
  async allowLeave() {
    if (this.saving) await this.saving;
    if (!this.hasUnsaved()) return true;
    if (
      !window.confirm(
        'Your PlayNote has not been confirmed saved. Discard local edits and leave? Cancel to keep writing.',
      )
    )
      return false;
    this.resetDraft();
    return true;
  }
  async flush() {
    if (this.saving) await this.saving;
    if (!this.hasUnsaved()) return true;
    this.error.set('Save or discard the PlayNote draft before exporting.');
    return false;
  }
  private message(e: unknown) {
    return e instanceof HttpErrorResponse
      ? (e.error?.detail ?? e.message)
      : 'Could not save or load PlayNotes.';
  }
}
