import { Component, OnDestroy, inject, signal, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { BASE_PATH } from '../src/api/generated/variables';
import { PlayerAccessControllerService } from '../src/api/generated/api/playerAccessController.service';
import type { PlayerIdentity } from '../src/api/generated/model/playerIdentity';

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
  imports: [MatButtonModule],
  template: ` <header class="player-header">
      <h1>{{ screen() === 'group' ? 'Group Cards' : 'My Cards' }}</h1>
      <button matButton type="button" (click)="navigate(screen() === 'group' ? 'mine' : 'group')">
        {{ screen() === 'group' ? 'My Cards' : 'Group Cards' }} ›
      </button>
    </header>
    <main>
      @if (identity(); as person) {
        <p class="identity">Playing as {{ person.displayName }}</p>
      }
      <p role="status" [class.error]="state() === 'denied' || state() === 'unpaired'">
        {{ message() }}
      </p>
      @if (identity()) {
        <section class="collection">
          <h2>Unsorted</h2>
          <p>
            {{
              screen() === 'group'
                ? 'Cards shared with the group will appear here.'
                : 'Cards shared with you will appear here.'
            }}
          </p>
        </section>
      }
      @if (state() !== 'connecting' && state() !== 'connected') {
        <button matButton type="button" (click)="reconnect()">Retry connection</button>
      }
    </main>`,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
    .player-header {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      justify-content: space-between;
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
    .error {
      color: var(--mat-sys-error);
    }
    @media (max-width: 450px) {
      .player-header {
        padding: 0.8rem;
        gap: 0.5rem;
      }
      h1 {
        font-size: 1.2rem;
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
  private readonly pop = () =>
    this.screen.set(location.pathname.endsWith('/mine') ? 'mine' : 'group');
  private readonly resume = () => {
    if (!document.hidden && this.state() !== 'connecting')
      void (this.identity() ? this.refresh() : this.reconnect());
  };
  constructor() {
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
    this.screen.set(screen);
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
      this.identity.set(result.identity);
      this.state.set('connected');
      this.screen.set('group');
      this.message.set(
        persisted
          ? 'Connected'
          : 'Connected. Browser storage is unavailable; pair again after closing this page.',
      );
      this.schedule();
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
        this.identity.set(person);
        this.state.set('connected');
        this.message.set('Connected');
        this.schedule();
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
  private async refresh() {
    clearTimeout(this.timer);
    const epoch = this.epoch;
    if (!this.credential) return;
    try {
      const person = await firstValueFrom(
        this.api
          .identifyPairedPlayer(`Bearer ${this.credential}`, 'body', false, this.json)
          .pipe(timeout(8000)),
      );
      if (epoch !== this.epoch) return;
      if (this.identity()?.campaign !== person.campaign) {
        this.identity.set(null);
        void this.reconnect();
        return;
      }
      this.identity.set(person);
      this.state.set('connected');
      this.message.set('Connected');
      this.schedule();
    } catch (error) {
      if (epoch === this.epoch) this.failure(error, false);
    }
  }
  private failure(error: unknown, pairing: boolean) {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      ++this.epoch;
      clearTimeout(this.timer);
      this.identity.set(null);
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
  providers: [provideHttpClient(), { provide: BASE_PATH, useValue: '' }],
}).catch(() => {
  document.body.textContent = 'Unable to open player cards. Reload to retry.';
});
