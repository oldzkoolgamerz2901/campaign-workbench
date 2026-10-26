import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import {
  PlaythroughControllerService,
  WorkspaceData,
  MoveCard,
  ReorderCards,
  ChooseCover,
  RenamePile,
  TransitionScene,
  SceneOverview,
} from '../../api/generated';

type Command =
  | { kind: 'move'; body: Omit<MoveCard, 'revision'> }
  | { kind: 'reorder'; body: Omit<ReorderCards, 'revision'> }
  | { kind: 'cover'; body: Omit<ChooseCover, 'revision'> }
  | { kind: 'rename'; body: Omit<RenamePile, 'revision'> }
  | { kind: 'scene'; body: Omit<TransitionScene, 'revision'> };
type Pending = { command: Command; revision?: number };
const options = { httpHeaderAccept: 'application/json' as const };

@Injectable({ providedIn: 'root' })
export class PlayWorkspaceState {
  private readonly api = inject(PlaythroughControllerService);
  readonly current = signal<WorkspaceData | null>(null);
  readonly status = signal<'saved' | 'pending' | 'saving' | 'failed'>('saved');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly overview = signal<SceneOverview | null>(null);
  readonly overviewLoading = signal(false);
  readonly commandBusy = signal(false);
  readonly retainedAction = signal('');
  private campaign = '';
  private session = '';
  private epoch = 0;
  private overviewEpoch = 0;
  private queue: Pending[] = [];
  private saving?: Promise<boolean>;

  hasUnsaved() {
    return this.queue.length > 0 || !!this.saving;
  }
  clear() {
    this.epoch++;
    this.closeOverview();
    this.queue = [];
    this.saving = undefined;
    this.campaign = this.session = '';
    this.current.set(null);
    this.status.set('saved');
    this.loading.set(false);
    this.commandBusy.set(false);
    this.error.set('');
    this.notice.set('');
    this.retainedAction.set('');
  }
  async open(campaign: string, session: string) {
    if (this.loading() && this.campaign === campaign && this.session === session) return;
    const previous = this.epoch;
    if (this.hasUnsaved() && !(await this.flush())) return;
    if (previous !== this.epoch) return;
    this.clear();
    this.campaign = campaign;
    this.session = session;
    const epoch = this.epoch;
    this.loading.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.openPlayWorkspace(campaign, session, 'body', false, options),
      );
      if (epoch === this.epoch) this.current.set(saved);
    } catch (error) {
      if (epoch === this.epoch) this.fail(error);
    } finally {
      if (epoch === this.epoch) this.loading.set(false);
    }
  }
  move(item: string, destination: MoveCard.DestinationEnum, index?: number) {
    return this.enqueue({ kind: 'move', body: { item, destination, index } });
  }
  reorder(location: ReorderCards.LocationEnum, items: string[]) {
    return this.enqueue({ kind: 'reorder', body: { location, items } });
  }
  cover(pile: ChooseCover.PileEnum, item: string) {
    return this.enqueue({ kind: 'cover', body: { pile, item } });
  }
  rename(pile: RenamePile.PileEnum, name: string | null) {
    return this.enqueue({ kind: 'rename', body: { pile, name } });
  }
  async transition(body: Omit<TransitionScene, 'revision'>) {
    const epoch = this.epoch;
    const ok = await this.enqueue({ kind: 'scene', body });
    if (ok && epoch === this.epoch) this.closeOverview();
    return ok;
  }
  private enqueue(command: Command) {
    if (!this.current() || this.loading() || this.status() === 'failed')
      return Promise.resolve(false);
    this.queue.push({ command });
    this.status.set('pending');
    return this.flush();
  }
  private dispatch(pending: Pending): Observable<WorkspaceData> {
    const c = pending.command;
    const body = { ...c.body, revision: pending.revision! };
    switch (c.kind) {
      case 'move':
        return this.api.movePlayCard(
          this.campaign,
          this.session,
          body as MoveCard,
          'body',
          false,
          options,
        );
      case 'reorder':
        return this.api.reorderPlayCards(
          this.campaign,
          this.session,
          body as ReorderCards,
          'body',
          false,
          options,
        );
      case 'cover':
        return this.api.choosePlayCover(
          this.campaign,
          this.session,
          body as ChooseCover,
          'body',
          false,
          options,
        );
      case 'rename':
        return this.api.renamePlayPile(
          this.campaign,
          this.session,
          body as RenamePile,
          'body',
          false,
          options,
        );
      case 'scene':
        return this.api.transitionPlayScene(
          this.campaign,
          this.session,
          body as TransitionScene,
          'body',
          false,
          options,
        );
    }
  }
  async flush(): Promise<boolean> {
    if (this.saving) return this.saving;
    if (this.status() === 'failed') return false;
    if (!this.queue.length) return !this.loading();
    const epoch = this.epoch;
    this.commandBusy.set(true);
    this.status.set('saving');
    this.error.set('');
    // Defer execution so synchronous Observable failures cannot leave a stale saving promise.
    const operation = Promise.resolve().then(async () => {
      while (this.queue.length && epoch === this.epoch) {
        const pending = this.queue[0];
        pending.revision ??= this.current()!.revision;
        try {
          const saved = await firstValueFrom(this.dispatch(pending));
          if (epoch !== this.epoch) return false;
          this.current.set(saved);
          this.queue.shift();
          this.notice.set('Table updated.');
        } catch (error) {
          if (epoch === this.epoch) {
            this.retainedAction.set(this.describe(pending.command));
            this.fail(error);
          }
          return false;
        }
      }
      if (epoch !== this.epoch) return false;
      this.status.set('saved');
      this.retainedAction.set('');
      return true;
    });
    this.saving = operation;
    try {
      return await operation;
    } finally {
      if (epoch === this.epoch) {
        this.saving = undefined;
        this.commandBusy.set(false);
      }
    }
  }
  private describe(command: Command) {
    switch (command.kind) {
      case 'move':
        return `Move card to ${command.body.destination.replaceAll('_', ' ').toLowerCase()}`;
      case 'reorder':
        return 'Reorder cards';
      case 'cover':
        return 'Choose displayed cover';
      case 'rename':
        return 'Rename pile';
      case 'scene':
        return 'Change Scene and chosen placements';
    }
  }
  async retry() {
    if (this.commandBusy() || !this.queue.length || !this.current()) return false;
    const epoch = this.epoch,
      pending = this.queue[0];
    this.commandBusy.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.openPlayWorkspace(this.campaign, this.session, 'body', false, options),
      );
      if (epoch !== this.epoch) return false;
      this.current.set(saved);
      if (saved.revision !== pending.revision) {
        this.error.set(
          'The saved arrangement changed or the action already completed. Your intent is retained. Reload / discard, review the table, then choose the action again.',
        );
        return false;
      }
      if (!window.confirm(`Retry retained action: ${this.describe(pending.command)}?`))
        return false;
      this.status.set('pending');
    } catch (error) {
      if (epoch === this.epoch) this.fail(error);
      return false;
    } finally {
      if (epoch === this.epoch) this.commandBusy.set(false);
    }
    return this.flush();
  }
  async loadOverview(scene: string) {
    const epoch = this.epoch,
      request = ++this.overviewEpoch;
    if (!(await this.flush()) || epoch !== this.epoch || request !== this.overviewEpoch) return;
    this.overviewLoading.set(true);
    try {
      const overview = await firstValueFrom(
        this.api.playSceneOverview(this.campaign, this.session, scene, 'body', false, options),
      );
      if (epoch === this.epoch && request === this.overviewEpoch) {
        this.current.set(overview.workspace);
        this.overview.set(overview);
      }
    } catch (error) {
      if (epoch === this.epoch && request === this.overviewEpoch)
        this.error.set(this.message(error));
    } finally {
      if (epoch === this.epoch && request === this.overviewEpoch) this.overviewLoading.set(false);
    }
  }
  async refreshOverview(scene: string) {
    if (this.status() === 'failed' && this.queue[0]?.command.kind === 'scene' && !this.saving) {
      // Explicit refresh abandons the failed command, but the dialog retains its choices for review.
      this.queue = [];
      this.retainedAction.set('');
      this.status.set('saved');
      this.error.set('');
    }
    await this.loadOverview(scene);
  }
  closeOverview() {
    this.overviewEpoch++;
    this.overview.set(null);
    this.overviewLoading.set(false);
  }
  async reload() {
    if (
      this.hasUnsaved() &&
      !window.confirm('Discard retained table actions and reload the saved workspace?')
    )
      return;
    const campaign = this.campaign,
      session = this.session,
      epoch = this.epoch;
    if (this.saving) await this.saving;
    if (epoch !== this.epoch) return;
    this.clear();
    if (campaign && session) await this.open(campaign, session);
  }
  async allowLeave() {
    if (!this.hasUnsaved() || (await this.flush())) return true;
    if (
      !window.confirm(
        'Table actions have not been confirmed saved. Discard retained actions and leave? Cancel to stay and review.',
      )
    )
      return false;
    this.clear();
    return true;
  }
  private message(error: unknown) {
    return error instanceof HttpErrorResponse
      ? (error.error?.detail ?? error.message)
      : 'Could not save or open the Play workspace.';
  }
  private fail(error: unknown) {
    this.status.set('failed');
    this.error.set(this.message(error));
  }
}
