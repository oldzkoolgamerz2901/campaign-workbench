import {
  SharingGestures,
  SharingDropTarget,
  SharingDrag,
} from '../src/app/sharing/sharing-gestures';
import {
  Component,
  OnDestroy,
  inject,
  signal,
  computed,
  viewChild,
  ElementRef,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout, tap, of } from 'rxjs';
import { Injectable } from '@angular/core';
import { PlayerCardsControllerService } from '../src/api/generated/api/playerCardsController.service';
import type { SharedPile, OrganizeCollection } from '../src/api/generated';
import type { SharedCardData } from '../src/api/generated/model/sharedCardData';
import type { CardLayout } from '../src/api/generated/model/cardLayout';
import { CARD_LAYOUT_CLIENT } from '../src/app/shared/card-layout/layout-client';
import { SharedCardTray } from '../src/app/sharing/shared-card-tray';
import type { ArtworkSource } from '../src/app/shared/artwork/artwork-image';
import { BASE_PATH } from '../src/api/generated/variables';
import { PlayerAccessControllerService } from '../src/api/generated/api/playerAccessController.service';
import type { PlayerIdentity } from '../src/api/generated/model/playerIdentity';

@Injectable({ providedIn: 'root' })
class PlayerCardTransport {
  readonly api = inject(PlayerCardsControllerService);
  constructor() {
    this.api.defaultHeaders = this.api.defaultHeaders.set('Content-Type', 'application/json');
  }
  credential = '';
  stale = false;
  onFailure: (error: unknown) => void = () => {};
  private readonly layouts = new Map<string, CardLayout>();
  // Bounded session memory for local reading, never browser-persistent offline storage.
  private readonly images = new Map<string, Blob>();
  private accessible = new Set<string>();
  private generation = 0;
  clear() {
    ++this.generation;
    this.layouts.clear();
    this.images.clear();
    this.accessible.clear();
    this.credential = '';
  }
  retain(cards: SharedCardData[]) {
    this.accessible = new Set(cards.map((card) => card.id));
    for (const id of this.layouts.keys()) if (!this.accessible.has(id)) this.layouts.delete(id);
    for (const id of this.images.keys()) if (!this.accessible.has(id)) this.images.delete(id);
  }
  artwork(id: string) {
    const cached = this.images.get(id);
    if (cached && this.accessible.has(id)) {
      this.images.delete(id);
      this.images.set(id, cached);
      return of(cached);
    }
    const generation = this.generation;
    return this.api.getPlayerCardArtwork(id, `Bearer ${this.credential}`).pipe(
      tap({
        next: (image) => {
          if (generation !== this.generation || !this.accessible.has(id)) return;
          this.images.delete(id);
          this.images.set(id, image);
          if (this.images.size > 16) this.images.delete(this.images.keys().next().value!);
        },
        error: (error) => {
          if (generation === this.generation) this.onFailure(error);
        },
      }),
    );
  }
  calculate(_content: unknown, id: string) {
    const cached = this.layouts.get(id);
    if (this.stale && cached) return of(cached);
    const credential = this.credential;
    const generation = this.generation;
    return this.api.getPlayerCardLayout(id, `Bearer ${credential}`).pipe(
      tap({
        next: (layout) => {
          if (generation === this.generation && this.accessible.has(id))
            this.layouts.set(id, layout);
        },
        error: (error) => {
          if (generation === this.generation) this.onFailure(error);
        },
      }),
    );
  }
}

const STORE = 'workbench.player.credentials.v1';
type Saved = { credentials: Record<string, string>; last?: string };
function readSaved(): Saved {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) || '{}');
    const credentials: Record<string, string> = {};
    for (const [id, token] of Object.entries(value.credentials || {}))
      if (
        /^[0-9a-f-]{36}$/i.test(id) &&
        typeof token === 'string' &&
        /^[A-Za-z0-9_-]{43}$/.test(token)
      )
        credentials[id] = token;
    return { credentials, last: typeof value.last === 'string' ? value.last : undefined };
  } catch {
    return { credentials: {} };
  }
}
@Component({
  selector: 'player-root',
  providers: [SharingGestures],
  imports: [MatButtonModule, SharedCardTray, SharingDropTarget],
  template: ` <header class="player-header">
      <h1>{{ screen() === 'group' ? 'Group Cards' : 'My Cards' }}</h1>
      <div class="player-info">
        @if (identity(); as person) {
          <span class="identity" [title]="'Playing as ' + person.displayName"
            >Playing as {{ person.displayName }}</span
          >
        }
        <span
          class="connection"
          [attr.role]="message() === 'Connected' || message() === 'Connecting…' ? 'status' : null"
          [attr.data-state]="state()"
          ><span class="status-dot" aria-hidden="true"></span
          >{{
            state() === 'connected'
              ? 'Connected'
              : state() === 'connecting'
                ? 'Connecting…'
                : state() === 'stale'
                  ? 'Disconnected'
                  : 'Access unavailable'
          }}</span
        >
      </div>
      <button
        matButton
        type="button"
        [sharingTarget]="{ kind: 'claim' }"
        [accepts]="acceptClaim"
        (dropped)="claimDrop($event.source.id)"
        (click)="navigate(screen() === 'group' ? 'mine' : 'group')"
      >
        {{ screen() === 'group' ? 'My Cards' : 'Group Cards' }}
        {{ arrivals()[screen() === 'group' ? 'mine' : 'group'] ? '· New' : '' }} ›
      </button>
    </header>
    <main>
      @if (message() !== 'Connected' && message() !== 'Connecting…') {
        <p role="status" [class.error]="state() === 'denied' || state() === 'unpaired'">
          {{ message() }}
        </p>
      }
      @if (identity()) {
        <section class="collection">
          <shared-card-tray
            [collection]="screen() === 'group' ? 'group' : identity()!.player"
            [claimable]="screen() === 'group'"
            [cards]="screen() === 'group' ? group() : mine()"
            [piles]="screen() === 'group' ? groupPiles() : myPiles()"
            [organizer]="screen() === 'mine'"
            [playerView]="true"
            [movable]="true"
            (organize)="organize($event)"
            [artwork]="artwork"
            [actions]="cardActions"
            [disabled]="state() !== 'connected' || commandBusy()"
            (command)="cardCommand($event)"
            [identity]="identity()!.campaign + screen()"
          />
        </section>
      }
      @if (state() !== 'connecting' && state() !== 'connected') {
        <button matButton type="button" (click)="reconnect()">Retry connection</button>
      }
    </main>
    <dialog #removeDialog aria-label="Remove inventory" (close)="removeCard.set(null)">
      <p>Remove {{ removeCard()?.visible?.title }} from My Cards? Your DM can restore it.</p>
      <button
        type="button"
        [disabled]="commandBusy() || state() !== 'connected'"
        (click)="confirmRemove()"
      >
        Confirm removal
      </button>
      <button type="button" (click)="removeDialog.close()">Cancel</button>
    </dialog>`,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
    .player-info {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 8rem;
      align-items: center;
      gap: 0.7rem;
      font-size: 0.85rem;
    }
    .identity {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .connection {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      white-space: nowrap;
      font-size: 0.75rem;
      color: var(--muted);
    }
    .status-dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 50%;
      background: #c59759;
      flex: none;
    }
    .connection[data-state='connected'] .status-dot {
      background: #80bc93;
      box-shadow: 0 0 0 3px #80bc9318;
    }
    .player-header > button,
    h1 {
      flex-shrink: 0;
    }
    .player-header {
      position: sticky;
      top: 0;
      z-index: 5;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
      gap: 1rem;
      align-items: center;
      background: var(--panel);
      border-bottom: 1px solid var(--line);
      padding: 1rem 1.4rem;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
    }
    .player-header > button {
      justify-self: end;
      width: 100%;
      max-width: 100%;
      min-height: 44px;
    }
    button {
      min-height: 44px;
    }
    main {
      max-width: 1000px;
      margin: auto;
      padding: 1.4rem;
    }
    .identity {
      color: var(--accent);
    }
    .collection {
      margin: 2rem 0;
      padding: 1.4rem;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
    }
    dialog {
      width: min(440px, calc(100vw - 2rem));
      max-height: 90dvh;
      box-sizing: border-box;
      overflow: auto;
      overflow-wrap: anywhere;
      padding: 1.4rem;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
      color: var(--ink);
    }
    dialog::backdrop {
      background: #000b;
    }
    .error {
      color: var(--mat-sys-error);
    }
    @media (max-width: 450px) {
      .player-header {
        padding: 0.8rem;
        gap: 0.5rem;
        grid-template-columns: 6rem minmax(0, 1fr) 7.5rem;
      }
      h1 {
        font-size: 0.95rem;
      }
      .player-info {
        grid-template-columns: minmax(0, 1fr);
        align-items: stretch;
        gap: 0.15rem;
        font-size: 0.68rem;
      }
      .connection {
        font-size: 0.65rem;
      }
      .player-header > button {
        font-size: 0.75rem;
        padding: 0 0.25rem;
      }

      main {
        padding: 1rem;
      }
    }
  `,
})
export class PlayerApp implements OnDestroy {
  private readonly json = { httpHeaderAccept: 'application/json' as const, transferCache: false };
  private readonly api = inject(PlayerAccessControllerService);
  readonly gestures = inject(SharingGestures);
  readonly acceptClaim = (source: SharingDrag) =>
    this.screen() === 'group' &&
    this.state() === 'connected' &&
    !this.commandBusy() &&
    source.kind === 'card' &&
    source.collection === 'group' &&
    source.mode === 'INVENTORY';
  private readonly collectionTray = viewChild(SharedCardTray);
  claimDrop(id: string) {
    const card = this.group().find((c) => c.id === id);
    if (card) this.collectionTray()?.invoke(card, 'Claim');
  }
  private readonly transport = inject(PlayerCardTransport);
  readonly commandBusy = signal(false);
  readonly removeCard = signal<SharedCardData | null>(null);
  private readonly removeDialog = viewChild<ElementRef<HTMLDialogElement>>('removeDialog');
  readonly cardActions = (card: SharedCardData) =>
    card.mode === 'INVENTORY' ? [this.screen() === 'group' ? 'Claim' : 'Remove'] : [];
  async cardCommand(event: { card: SharedCardData; action: string }) {
    if (this.state() !== 'connected' || this.commandBusy()) return;
    if (event.action === 'Remove') {
      this.removeCard.set(event.card);
      this.removeDialog()?.nativeElement.showModal();
    } else await this.runCommand(event.card, 'claim');
  }
  async confirmRemove() {
    const card = this.removeCard();
    if (!card || this.state() !== 'connected' || this.commandBusy()) return;
    await this.runCommand(card, 'remove');
    this.removeDialog()?.nativeElement.close();
  }
  private async runCommand(card: SharedCardData, action: 'claim' | 'remove') {
    if (!this.credential) return;
    const epoch = this.epoch;
    this.commandBusy.set(true);
    // Supersede an older polling response before changing authoritative state.
    ++this.readGeneration;
    this.refreshing = false;
    clearTimeout(this.timer);
    try {
      const call =
        action === 'claim'
          ? this.transport.api.claimPlayerCard(
              card.id,
              `Bearer ${this.credential}`,
              'body',
              false,
              this.json,
            )
          : this.transport.api.removePlayerCard(
              card.id,
              `Bearer ${this.credential}`,
              'body',
              false,
              this.json,
            );
      await firstValueFrom(call.pipe(timeout(8000)));
      if (epoch !== this.epoch) return;
      await this.refresh(true);
      if (this.state() === 'connected')
        this.message.set(
          action === 'claim' ? 'Card claimed. Find it in My Cards.' : 'Card removed.',
        );
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error instanceof HttpErrorResponse && error.status === 409) {
        await this.refresh(true);
        if (this.state() === 'connected')
          this.message.set('This card is no longer available for that action.');
      } else this.failure(error, false);
    } finally {
      this.commandBusy.set(false);
    }
  }
  async organize(request: OrganizeCollection) {
    if (this.state() !== 'connected' || this.commandBusy() || !this.credential) return;
    const epoch = this.epoch;
    this.commandBusy.set(true);
    ++this.readGeneration;
    this.refreshing = false;
    clearTimeout(this.timer);
    try {
      await firstValueFrom(
        (this.screen() === 'group'
          ? this.transport.api.organizePlayerGroupCollection(
              request,
              `Bearer ${this.credential}`,
              'body',
              false,
              this.json,
            )
          : this.transport.api.organizePlayerCollection(
              request,
              `Bearer ${this.credential}`,
              'body',
              false,
              this.json,
            )
        ).pipe(timeout(8000)),
      );
      if (epoch === this.epoch) await this.refresh(true);
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error instanceof HttpErrorResponse && (error.status === 409 || error.status === 400)) {
        await this.refresh(true);
        if (this.state() === 'connected')
          this.message.set(
            error.status === 409
              ? 'Organization changed. Refresh and try again.'
              : 'Enter a valid pile name.',
          );
      } else this.failure(error, false);
    } finally {
      this.commandBusy.set(false);
    }
  }
  readonly groupPiles = signal<SharedPile[]>([]);
  readonly myPiles = signal<SharedPile[]>([]);
  private readGeneration = 0;
  readonly group = signal<SharedCardData[]>([]);
  readonly mine = signal<SharedCardData[]>([]);
  readonly arrivals = signal({ group: false, mine: false });
  private loaded = false;
  private refreshing = false;
  readonly artwork = (card: SharedCardData): ArtworkSource | null =>
    card.artwork
      ? {
          key: `${this.identity()?.campaign}.${card.id}`,
          load: () => this.transport.artwork(card.id),
        }
      : null;
  private clearCards() {
    this.removeDialog()?.nativeElement.close();
    this.groupPiles.set([]);
    this.myPiles.set([]);
    this.group.set([]);
    this.mine.set([]);
    this.arrivals.set({ group: false, mine: false });
    this.loaded = false;
    this.transport.clear();
  }
  private acceptCards(group: SharedCardData[], mine: SharedCardData[]) {
    this.transport.retain([...group, ...mine]);
    if (this.removeCard() && !mine.some((card) => card.id === this.removeCard()!.id))
      this.removeDialog()?.nativeElement.close();
    const added = (before: SharedCardData[], after: SharedCardData[]) =>
      after.some((card) => !before.some((old) => old.id === card.id));
    this.arrivals.update((old) => ({
      group:
        this.screen() !== 'group' && (old.group || (this.loaded && added(this.group(), group))),
      mine: this.screen() !== 'mine' && (old.mine || (this.loaded && added(this.mine(), mine))),
    }));
    this.group.set(group);
    this.mine.set(mine);
    this.loaded = true;
  }

  readonly identity = signal<PlayerIdentity | null>(null);
  readonly state = signal<'connecting' | 'connected' | 'stale' | 'denied' | 'unpaired'>(
    'connecting',
  );
  readonly message = signal('Connecting…');
  readonly screen = signal<'group' | 'mine'>(
    location.pathname.endsWith('/mine') ? 'mine' : 'group',
  );
  private saved = readSaved();
  private credential: string | null = null;
  private pendingToken: string | null = null;
  private pairingRejected = false;
  private epoch = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly pop = () => {
    const screen = location.pathname.endsWith('/mine') ? 'mine' : 'group';
    this.screen.set(screen);
    this.arrivals.update((value) => ({ ...value, [screen]: false }));
  };
  private readonly resume = () => {
    if (!document.hidden && this.state() !== 'connecting')
      void (this.identity() ? this.refresh() : this.reconnect());
  };
  constructor() {
    this.transport.onFailure = (error) => this.failure(error, false);
    window.addEventListener('popstate', this.pop);
    document.addEventListener('visibilitychange', this.resume);
    const token = new URLSearchParams(location.hash.slice(1)).get('token');
    // Remove temporary secrets before any HTTP exchange or further navigation.
    if (token !== null || location.pathname.endsWith('/pair') || location.pathname === '/player/')
      history.replaceState(null, '', '/player/group');
    if (token !== null) void this.pair(token);
    else void this.reconnect();
  }
  navigate(screen: 'group' | 'mine') {
    this.gestures.cancel();
    this.screen.set(screen);
    this.arrivals.update((value) => ({ ...value, [screen]: false }));
    history.pushState(null, '', `/player/${screen}`);
  }
  private save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(this.saved));
      return true;
    } catch {
      return false;
    }
  }
  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), 4000);
  }
  private async pair(token: string) {
    this.pendingToken = token;
    this.pairingRejected = false;
    const epoch = ++this.epoch;
    this.identity.set(null);
    this.clearCards();
    this.state.set('connecting');
    this.message.set('Connecting your device…');
    try {
      const result = await firstValueFrom(
        this.api.redeemPlayerPairing({ token }, 'body', false, this.json).pipe(timeout(8000)),
      );
      if (epoch !== this.epoch) return;
      this.pendingToken = null;
      this.saved.credentials[result.identity.campaign] = result.credential;
      this.saved.last = result.identity.campaign;
      const persisted = this.save();
      this.credential = result.credential;
      this.transport.credential = result.credential;
      this.identity.set(result.identity);
      this.state.set('connected');
      this.screen.set('group');
      this.message.set(
        persisted
          ? 'Connected'
          : 'Connected. Browser storage is unavailable; pair again after closing this page.',
      );
      await this.refresh();
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
        this.pendingToken = null;
        this.pairingRejected = true;
      }
      this.failure(error, true);
    }
  }
  async reconnect() {
    if (this.pendingToken !== null) {
      await this.pair(this.pendingToken);
      return;
    }
    if (this.pairingRejected) {
      this.message.set('Ask your DM for a new pairing QR code.');
      return;
    }
    if (this.identity() && this.credential) {
      await this.refresh();
      return;
    }
    clearTimeout(this.timer);
    const epoch = ++this.epoch;
    this.identity.set(null);
    this.clearCards();
    this.state.set('connecting');
    this.message.set('Connecting…');
    const ids = [...new Set([this.saved.last, ...Object.keys(this.saved.credentials)])].filter(
      (id): id is string => !!id && !!this.saved.credentials[id],
    );
    if (!ids.length) {
      this.state.set('unpaired');
      this.message.set('Ask your DM for a new pairing QR code.');
      return;
    }
    let denied: unknown;
    for (const id of ids) {
      try {
        const token = this.saved.credentials[id];
        const person = await firstValueFrom(
          this.api
            .identifyPairedPlayer(`Bearer ${token}`, 'body', false, this.json)
            .pipe(timeout(8000)),
        );
        if (epoch !== this.epoch) return;
        this.saved.last = person.campaign;
        this.save();
        this.credential = token;
        this.transport.credential = token;
        this.identity.set(person);
        this.state.set('connected');
        this.message.set('Connected');
        await this.refresh();
        return;
      } catch (error) {
        if (epoch !== this.epoch) return;
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          denied = error;
          continue;
        }
        this.failure(error, false);
        return;
      }
    }
    this.failure(denied, false);
  }
  private async refresh(force = false) {
    if ((this.refreshing || this.commandBusy()) && !force) return;
    const generation = ++this.readGeneration;
    clearTimeout(this.timer);
    const epoch = this.epoch;
    if (!this.credential) return;
    this.refreshing = true;
    try {
      const data = await firstValueFrom(
        this.transport.api
          .getPlayerCollections(`Bearer ${this.credential}`, 'body', false, this.json)
          .pipe(timeout(8000)),
      );
      if (epoch !== this.epoch || generation !== this.readGeneration) return;
      if (this.identity()?.campaign !== data.identity.campaign) {
        this.identity.set(null);
        this.clearCards();
        void this.reconnect();
        return;
      }
      this.identity.set(data.identity);
      this.groupPiles.set(data.group.piles);
      this.myPiles.set(data.mine.piles);
      this.acceptCards(data.group.cards, data.mine.cards);
      this.transport.stale = false;
      this.state.set('connected');
      this.message.set('Connected');
      this.schedule();
    } catch (error) {
      if (epoch === this.epoch && generation === this.readGeneration) this.failure(error, false);
    } finally {
      if (generation === this.readGeneration) this.refreshing = false;
    }
  }
  private failure(error: unknown, pairing: boolean) {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      ++this.epoch;
      clearTimeout(this.timer);
      this.identity.set(null);
      this.clearCards();
      this.state.set('denied');
      this.message.set(
        pairing
          ? 'This pairing code is invalid, expired or was already used. Ask your DM for a new code.'
          : error.status === 403
            ? 'Your player is inactive. Ask your DM to reactivate access.'
            : 'Access is unavailable for this campaign. Ask your DM or retry when sharing resumes.',
      );
    } else if (error instanceof HttpErrorResponse && error.status === 400) {
      this.identity.set(null);
      this.state.set('unpaired');
      this.message.set('This pairing link is invalid. Ask your DM for a new code.');
    } else {
      this.transport.stale = true;
      this.state.set('stale');
      this.message.set(
        pairing
          ? 'The connection was interrupted. Retry; if pairing already completed, ask your DM for a new code.'
          : 'Connection lost. Displayed information may be out of date. Reconnecting…',
      );
      if (this.credential) this.schedule();
    }
  }
  ngOnDestroy() {
    ++this.epoch;
    clearTimeout(this.timer);
    window.removeEventListener('popstate', this.pop);
    document.removeEventListener('visibilitychange', this.resume);
  }
}
bootstrapApplication(PlayerApp, {
  providers: [
    provideHttpClient(),
    { provide: BASE_PATH, useValue: '' },
    { provide: CARD_LAYOUT_CLIENT, useFactory: () => inject(PlayerCardTransport) },
  ],
}).catch(() => {
  document.body.textContent = 'Unable to open player cards. Reload to retry.';
});
