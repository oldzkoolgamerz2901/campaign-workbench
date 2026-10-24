import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  PlayHistoryControllerService,
  PlayNoteControllerService,
  PlayHistoryTarget,
  PlayHistoryPage,
  PlayHistoryEntry,
  ResourceSnapshot,
} from '../../api/generated';

const options = { httpHeaderAccept: 'application/json' as const };
@Injectable()
export class PlayHistoryState {
  private readonly api = inject(PlayHistoryControllerService);
  private readonly notesApi = inject(PlayNoteControllerService);
  readonly expanded = signal(false);
  readonly targets = signal<PlayHistoryTarget[]>([]);
  readonly targetsLoading = signal(false);
  readonly targetsError = signal('');
  readonly selectedItem = signal('');
  readonly target = signal<ResourceSnapshot | null>(null);
  readonly kind = signal<'resource' | 'scene'>('resource');
  readonly entries = signal<PlayHistoryEntry[]>([]);
  readonly pins = signal<PlayHistoryEntry[]>([]);
  readonly page = signal<PlayHistoryPage | null>(null);
  readonly pinPage = signal<PlayHistoryPage | null>(null);
  readonly loading = signal(false);
  readonly pinsLoading = signal(false);
  readonly error = signal('');
  readonly pinsError = signal('');
  private campaign = '';
  private session = '';
  private epoch = 0;
  private targetsEpoch = 0;
  open(campaign: string, session: string) {
    if (this.campaign !== campaign || this.session !== session) {
      this.epoch++;
      this.target.set(null);
      this.selectedItem.set('');
      this.expanded.set(false);
      this.clearPages();
      this.campaign = campaign;
      this.session = session;
    }
    void this.reloadTargets();
  }
  private clearPages() {
    this.entries.set([]);
    this.pins.set([]);
    this.page.set(null);
    this.pinPage.set(null);
    this.error.set('');
    this.pinsError.set('');
    this.loading.set(false);
    this.pinsLoading.set(false);
  }
  async reloadTargets() {
    const epoch = ++this.targetsEpoch;
    this.targets.set([]);
    this.targetsLoading.set(true);
    this.targetsError.set('');
    try {
      const result = await firstValueFrom(
        this.notesApi.playHistoryTargets(this.campaign, this.session, 'body', false, options),
      );
      if (epoch === this.targetsEpoch) this.targets.set(result.targets);
    } catch (e) {
      if (epoch === this.targetsEpoch) this.targetsError.set(this.message(e));
    } finally {
      if (epoch === this.targetsEpoch) this.targetsLoading.set(false);
    }
  }
  choose(item: string) {
    this.selectedItem.set(item);
    void this.show(
      this.targets().find((t) => t.item === item)?.resource ?? null,
      this.kind(),
      true,
    );
  }
  async show(target: ResourceSnapshot | null, kind: 'resource' | 'scene', keepItem = false) {
    this.epoch++;
    if (!keepItem) this.selectedItem.set('');
    this.target.set(target);
    this.kind.set(kind);
    this.expanded.set(true);
    this.clearPages();
    if (target?.reference) await Promise.all([this.load(false), this.load(true)]);
  }
  async load(pinnedOnly: boolean, more = false) {
    const loading = pinnedOnly ? this.pinsLoading : this.loading;
    const error = pinnedOnly ? this.pinsError : this.error;
    const page = pinnedOnly ? this.pinPage : this.page;
    const entries = pinnedOnly ? this.pins : this.entries;
    const target = this.target()?.reference;
    if (!target || loading()) return;
    const cursor = more ? page() : null;
    if (more && !cursor?.nextId) return;
    const epoch = this.epoch;
    loading.set(true);
    error.set('');
    try {
      const query =
        this.kind() === 'scene'
          ? this.api.scenePlayHistory.bind(this.api)
          : this.api.resourcePlayHistory.bind(this.api);
      const result = await firstValueFrom(
        query(
          this.campaign,
          target.campaign,
          target.card,
          pinnedOnly,
          20,
          cursor?.nextTime ?? undefined,
          cursor?.nextId ?? undefined,
          'body',
          false,
          options,
        ),
      );
      if (epoch !== this.epoch) return;
      // Repeated reloads/retries never append a second copy of a saved note.
      const previous = more ? entries() : [];
      const ids = new Set(previous.map((e) => e.note.id));
      entries.set([...previous, ...result.entries.filter((e) => !ids.has(e.note.id))]);
      page.set(result);
    } catch (e) {
      if (epoch === this.epoch) error.set(this.message(e));
    } finally {
      if (epoch === this.epoch) loading.set(false);
    }
  }
  private message(e: unknown) {
    return e instanceof HttpErrorResponse
      ? (e.error?.detail ?? e.message)
      : 'Could not load history. Retry the request.';
  }
}
