import { Component, effect, inject, input, output } from '@angular/core';
import { NavigationContext } from '../navigation-context';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

export type WorkbenchMode = 'library' | 'write' | 'prepare' | 'play';
@Component({
  selector: 'workbench-header',
  imports: [FormsModule, MatButtonModule],
  template: `
    <header class="workbench-header">
      <h1>
        <svg aria-hidden="true" viewBox="0 0 32 28">
          <path d="M16 5C11 1 6 1 2 3v21c5-2 9-1 14 2 5-3 9-4 14-2V3c-4-2-9-2-14 2Z" />
          <path d="M16 5v21M6 6v13M26 6v13" /></svg
        ><span>Campaign Workbench</span>
      </h1>
      <select
        aria-label="Campaign"
        [disabled]="disabled()"
        [ngModel]="campaign()"
        (ngModelChange)="selectCampaign.emit($event)"
      >
        <option value="" disabled>Select a campaign</option>
        @for (entry of campaigns(); track entry.id) {
          <option [value]="entry.id">{{ entry.name }}</option>
        }
      </select>
      <label class="destination"
        >Session
        <select
          aria-label="Current session"
          [disabled]="disabled()"
          [ngModel]="context.session()"
          (ngModelChange)="context.select($event)"
          (focus)="context.reload()"
        >
          <option value="">No session selected</option>
          @for (session of context.sessions(); track session.id) {
            <option [value]="session.id">{{ session.title }}</option>
          }
        </select>
      </label>
      @if (context.error()) {
        <button matButton (click)="context.reload()">Retry sessions</button>
      }
      <nav aria-label="Workspace mode">
        @for (entry of modes; track entry.value) {
          <button
            matButton
            [disabled]="disabled()"
            [attr.aria-current]="mode() === entry.value ? 'page' : null"
            (click)="selectMode.emit(entry.value)"
          >
            {{ entry.label }}
          </button>
        }
      </nav>
      <span class="save-status" role="status" [attr.aria-label]="statusLabel()">{{
        status()
      }}</span>
      <ng-content select="[headerActions]" />
    </header>
  `,
  styleUrl: './workbench-header.css',
})
export class WorkbenchHeader {
  readonly context = inject(NavigationContext);
  constructor() {
    effect(() => {
      const campaign = this.campaign();
      if (
        campaign &&
        !this.context.router.parseUrl(this.context.router.url).queryParams['campaign']
      ) {
        void this.context.router.navigate([], {
          queryParams: { campaign },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }
  readonly campaign = input('');
  readonly campaigns = input<{ id: string; name: string }[]>([]);
  readonly mode = input<WorkbenchMode>('prepare');
  readonly disabled = input(false);
  readonly status = input('');
  readonly statusLabel = input('Save status');
  readonly selectCampaign = output<string>();
  readonly selectMode = output<WorkbenchMode>();
  readonly modes = [
    { value: 'library', label: 'Library' },
    { value: 'write', label: 'Write' },
    { value: 'prepare', label: 'Prepare' },
    { value: 'play', label: 'Play' },
  ] as const;
}
