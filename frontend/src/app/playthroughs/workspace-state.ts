import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PlaythroughControllerService, WorkspaceData } from '../../api/generated';

@Injectable({ providedIn: 'root' })
export class PlayWorkspaceState {
  private readonly api = inject(PlaythroughControllerService);
  readonly current = signal<WorkspaceData | null>(null);
  readonly status = signal<'saved' | 'pending' | 'saving' | 'failed'>('saved');
  readonly loading = signal(false);
  readonly error = signal('');
  // Presentation only: never included in workspace saves or archives.
  readonly expandedItemId = signal<string | null>(null);
  readonly inspectionItemId = signal<string | null>(null);
  private campaign = '';
  private session = '';
  private epoch = 0;
  private generation = 0;
  private dirty = false;
  private saving?: Promise<boolean>;
  private timer?: ReturnType<typeof setTimeout>;

  hasUnsaved() {
    return this.dirty || !!this.saving;
  }

  clear() {
    this.epoch++;
    clearTimeout(this.timer);
    this.saving = undefined;
    this.dirty = false;
    this.campaign = this.session = '';
    this.current.set(null);
    this.expandedItemId.set(null);
    this.inspectionItemId.set(null);
    this.status.set('saved');
    this.loading.set(false);
    this.error.set('');
  }

  async open(campaign: string, session: string) {
    if (this.loading() && this.campaign === campaign && this.session === session) return;
    const openingEpoch = this.epoch;
    if (this.hasUnsaved() && !(await this.flush())) return;
    if (openingEpoch !== this.epoch) return;
    const expanded =
      this.campaign === campaign && this.session === session ? this.expandedItemId() : null;
    this.clear();
    this.expandedItemId.set(expanded);
    this.campaign = campaign;
    this.session = session;
    const epoch = this.epoch;
    this.loading.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.openPlayWorkspace(campaign, session, 'body', false, {
          httpHeaderAccept: 'application/json',
        }),
      );
      if (epoch === this.epoch) {
        this.current.set(saved);
        this.reconcilePresentation();
      }
    } catch (e) {
      if (epoch === this.epoch) this.fail(e);
    } finally {
      if (epoch === this.epoch) this.loading.set(false);
    }
  }

  move(id: string, to: number) {
    const table = this.current();
    if (!table) return;
    const active = [...table.active],
      from = active.indexOf(id);
    if (from < 0 || to < 0 || to >= active.length || from === to) return;
    active.splice(from, 1);
    active.splice(to, 0, id);
    this.edit({ ...table, active });
  }

  use(id: string) {
    const table = this.current();
    if (table?.active.includes(id))
      this.edit({
        ...table,
        active: table.active.filter((x) => x !== id),
        used: [id, ...table.used],
      });
  }

  restore(id: string) {
    const table = this.current();
    if (table?.used.includes(id))
      this.edit({
        ...table,
        active: [id, ...table.active],
        used: table.used.filter((x) => x !== id),
      });
  }

  // Inspection/selection never calls this command. Only explicit scene activation does.
  activateScene(itemId: string | null) {
    const table = this.current();
    if (!table || table.activeSceneItemId === itemId) return;
    if (itemId !== null && ![...table.active, ...table.used].includes(itemId)) return;
    this.edit({ ...table, activeSceneItemId: itemId });
  }

  setFocus(itemIds: string[]) {
    const table = this.current();
    if (
      !table ||
      itemIds.length > 3 ||
      new Set(itemIds).size !== itemIds.length ||
      itemIds.some((id) => ![...table.active, ...table.used].includes(id))
    )
      return;
    if (
      itemIds.every((id, index) => table.focusedItemIds[index] === id) &&
      itemIds.length === table.focusedItemIds.length
    )
      return;
    this.edit({ ...table, focusedItemIds: [...itemIds] });
    this.reconcilePresentation();
  }

  focus(id: string) {
    const ids = this.current()?.focusedItemIds;
    if (!ids || this.loading() || ids.includes(id) || ids.length === 3) return;
    this.setFocus([...ids, id]);
    if (this.current()?.focusedItemIds.includes(id)) this.inspectionItemId.set(null);
  }

  unfocus(id: string) {
    const ids = this.current()?.focusedItemIds;
    if (ids && !this.loading()) this.setFocus(ids.filter((value) => value !== id));
  }

  replaceFocus(slot: number, id: string) {
    const table = this.current();
    if (
      !table ||
      this.loading() ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= table.focusedItemIds.length ||
      table.focusedItemIds.includes(id) ||
      ![...table.active, ...table.used].includes(id)
    )
      return;
    const ids = [...table.focusedItemIds];
    ids[slot] = id;
    this.setFocus(ids);
    this.inspectionItemId.set(null);
  }

  inspect(id: string) {
    const table = this.current();
    if (!table || this.loading() || ![...table.active, ...table.used].includes(id)) return;
    this.inspectionItemId.set(table.focusedItemIds.includes(id) ? null : id);
  }

  expand(id: string | null) {
    if (this.loading() || (id !== null && !this.current()?.focusedItemIds.includes(id))) return;
    this.expandedItemId.set(id);
    this.inspectionItemId.set(null);
  }

  private reconcilePresentation() {
    const table = this.current();
    if (!table) return;
    if (!table.focusedItemIds.includes(this.expandedItemId() ?? '')) this.expandedItemId.set(null);
    const inspection = this.inspectionItemId();
    if (
      inspection &&
      (table.focusedItemIds.includes(inspection) ||
        ![...table.active, ...table.used].includes(inspection))
    )
      this.inspectionItemId.set(null);
  }

  private edit(table: WorkspaceData) {
    if (this.loading()) return;
    this.current.set(table);
    this.dirty = true;
    this.generation++;
    if (this.status() === 'failed') return;
    this.status.set(this.saving ? 'saving' : 'pending');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 500);
  }

  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    const epoch = this.epoch;
    if (this.saving) {
      if (!(await this.saving) || epoch !== this.epoch) return false;
      return this.flush();
    }
    const snapshot = this.current();
    if (!snapshot || !this.dirty) return !this.loading();
    const generation = this.generation;
    this.status.set('saving');
    this.error.set('');
    this.saving = (async () => {
      try {
        const saved = await firstValueFrom(
          this.api.savePlayWorkspace(
            this.campaign,
            snapshot.session,
            {
              revision: snapshot.revision,
              active: snapshot.active,
              used: snapshot.used,
              activeSceneItemId: snapshot.activeSceneItemId,
              focusedItemIds: snapshot.focusedItemIds,
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
          this.current.update((value) => (value ? { ...value, revision: saved.revision } : value));
          this.status.set('pending');
        }
        return true;
      } catch (e) {
        if (epoch === this.epoch) this.fail(e);
        return false;
      } finally {
        if (epoch === this.epoch) this.saving = undefined;
      }
    })();
    const ok = await this.saving;
    return ok && epoch === this.epoch && this.dirty ? this.flush() : ok;
  }

  async reload() {
    if (
      this.hasUnsaved() &&
      !window.confirm('Discard local table changes and reload the saved workspace?')
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
        'Table changes have not been saved. Discard these local changes and leave? Cancel to stay and retry.',
      )
    )
      return false;
    this.clear();
    return true;
  }

  private fail(e: unknown) {
    // An edit queued during a slow save must not retry after that save fails.
    clearTimeout(this.timer);
    this.status.set('failed');
    this.error.set(
      e instanceof HttpErrorResponse
        ? (e.error?.detail ?? e.message)
        : 'Could not save or open the Play workspace.',
    );
  }
}
