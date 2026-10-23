import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PreparationControllerService, SessionSummary } from '../../api/generated';

/** Route-owned destination only; never owns content or a save queue. */
@Injectable({ providedIn: 'root' })
export class NavigationContext {
  readonly router = inject(Router);
  private readonly api = inject(PreparationControllerService);
  readonly campaign = signal('');
  readonly session = signal('');
  readonly sessions = signal<SessionSummary[]>([]);
  readonly error = signal('');
  private epoch = 0;
  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) void this.readRoute();
    });
    void this.readRoute();
  }
  private async readRoute() {
    const query = this.router.parseUrl(this.router.url).queryParams;
    const campaign = query['campaign'] ?? '';
    this.session.set(query['session'] ?? '');
    if (campaign === this.campaign()) return;
    this.campaign.set(campaign);
    this.sessions.set([]);
    await this.reload();
  }
  async reload() {
    const campaign = this.campaign(),
      token = ++this.epoch;
    this.error.set('');
    if (!campaign) return;
    try {
      const result = await firstValueFrom(this.api.listSessions(campaign));
      if (token === this.epoch) this.sessions.set(result.sessions);
    } catch {
      if (token === this.epoch) this.error.set('Cannot load sessions. Retry sessions.');
    }
  }
  select(session: string) {
    return this.router.navigate([], {
      queryParams: { session: session || null },
      queryParamsHandling: 'merge',
    });
  }
}
