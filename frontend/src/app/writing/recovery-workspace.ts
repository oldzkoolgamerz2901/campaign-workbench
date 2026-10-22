import { WritingArtwork } from '../writing/artwork-sources';
import { Component, inject, OnDestroy, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RecoveryState } from './recovery-state';
import { CampaignControllerService } from '../../api/generated';
import { firstValueFrom } from 'rxjs';
import { signal } from '@angular/core';
import { DraftReader } from './draft-reader';
import { PlayingCard } from '../shared/playing-card/playing-card';

@Component({
  selector: 'writing-recovery',
  imports: [FormsModule, DraftReader, PlayingCard],
  template: `
    <main>
      <h2>Writing recovery</h2>
      <p>
        Read-only recovered work. Restoring creates a separate workspace without attaching campaign
        folders.
      </p>
      <p>
        Archives contain saved drafts, retained approved revisions, exports and source evidence.
        Sessions and unsaved edits are excluded. Portable ZIP (or legacy JSON). Limit: 256 MiB,
        1,000 drafts, 10,000 retained records.
      </p>
      <button (click)="router.navigate(['/writing'])" [disabled]="state.busy()">
        Return to Writing
      </button>
      <section aria-label="Writing archive transfer">
        <label
          >Backup campaign<select
            aria-label="Backup campaign"
            [(ngModel)]="backupCampaign"
            [disabled]="state.busy()"
          >
            <option value="">Choose a campaign</option>
            @for (c of campaigns(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select></label
        >
        <button (click)="state.backup(backupCampaign)" [disabled]="!backupCampaign || state.busy()">
          Download Writing archive
        </button>
        <label
          >Restore Writing archive<input
            aria-label="Restore Writing archive"
            type="file"
            accept="application/zip,.zip,application/json,.json"
            (change)="upload($event)"
            [disabled]="state.busy()"
        /></label>
        <button (click)="state.load()" [disabled]="state.busy()">Reload recovery workspaces</button>
      </section>
      @if (state.error()) {
        <p role="alert">{{ state.error() }}</p>
      }
      @if (state.notice()) {
        <p role="status">{{ state.notice() }}</p>
      }
      @if (state.busy()) {
        <p role="status">Transfer in progress…</p>
      }
      <nav aria-label="Recovery workspaces">
        @for (w of state.workspaces(); track w.id) {
          <button (click)="state.open(w.id)" [disabled]="state.busy()">
            {{ w.name }} · {{ w.restoredAt }} · {{ w.drafts }} drafts
          </button>
        } @empty {
          <p>No recovery workspaces yet.</p>
        }
      </nav>
      @if (state.index(); as index) {
        <section aria-label="Recovered records">
          <h3>{{ index.workspace.name }}</h3>
          <p>
            {{ index.workspace.drafts }} current drafts · {{ index.workspace.approved }} retained
            approved revisions · {{ index.workspace.exports }} exports
          </p>
          <p>
            Historical approvals do not approve new session use. Session-specific approval records
            belong to session archives.
          </p>
          <button (click)="state.reexport()" [disabled]="state.busy()">
            Download recovered archive
          </button>
          <label
            >Record kind<select
              aria-label="Record kind"
              [ngModel]="state.kind()"
              (ngModelChange)="state.kind.set($event)"
            >
              <option value="draft">Current drafts</option>
              <option value="approved">Approved revisions</option>
              <option value="export">Export artifacts</option>
            </select></label
          >
          <label
            >Type group<select
              aria-label="Type group"
              [ngModel]="state.group()"
              (ngModelChange)="state.group.set($event)"
            >
              @for (type of types; track type) {
                <option [value]="type">{{ type }}</option>
              }
            </select></label
          >
          <ul>
            @for (r of state.records(); track r.key) {
              <li>
                <button (click)="state.select(r.key)" [disabled]="state.busy()">
                  {{ r.title || 'Untitled draft' }} · {{ r.type }} · revision {{ r.revision }}
                </button>
              </li>
            } @empty {
              <li>No records in this group.</li>
            }
          </ul>
        </section>
      }
      @if (state.detail(); as d) {
        <article aria-label="Recovered document">
          <h3>
            {{ d.snapshot.fields.title || 'Untitled draft' }} · revision {{ d.snapshot.revision }}
          </h3>
          <p>
            Original campaign {{ d.snapshot.campaign }} · draft {{ d.snapshot.id }} · card
            {{ d.snapshot.card }}
          </p>
          <p>
            Suggested placement: {{ d.snapshot.fields.path }} · metadata status:
            {{ d.snapshot.fields.status }}
          </p>
          @if (d.snapshot.recovery; as previous) {
            <p>
              Previously recovered from workspace {{ previous.workspace }} · draft
              {{ previous.draft }} · revision {{ previous.revision }}
            </p>
          }
          @if (d.snapshot.origin; as origin) {
            <details>
              <summary>Original source evidence · {{ origin.path }}</summary>
              <p>{{ origin.hash }}</p>
              <pre>{{ origin.raw }}</pre>
              <pre>{{ origin.retainedEnvelope }}</pre>
            </details>
          }
          @if (d.hash) {
            <p>Historical content SHA-256: {{ d.hash }}</p>
          }
          @if (d.report; as report) {
            <details>
              <summary>Historical export checks</summary>
              <p>Created {{ d.createdAt }} · warnings acknowledged: {{ d.acknowledged }}</p>
              <p>Checked capture {{ report.capture }} · fingerprint {{ report.fingerprint }}</p>
              @for (warning of report.warnings; track $index) {
                <p>{{ warning }}</p>
              }
            </details>
          }
          <playing-card
            [artwork]="artwork.recovered(state.index()!.workspace.id, d.record.key, d.snapshot)"
            [title]="d.snapshot.fields.title"
            [type]="d.snapshot.fields.type"
            [tags]="d.snapshot.fields.tags"
            [summary]="d.snapshot.fields.summary"
            (openDocument)="full.set(true)"
          />
          <button (click)="full.set(!full())">
            {{ full() ? 'Hide full document' : 'Open full document' }}
          </button>
          @if (full()) {
            <draft-reader [preview]="d.preview" />
          }
          <p>
            Historical source/draft links stay unavailable here. No live campaign targets are
            loaded.
          </p>
          <details>
            <summary>Historical link evidence</summary>
            @for (link of d.links; track $index) {
              <p>
                {{ link.destination }} · {{ link.kind }} · {{ link.draft }} · revision
                {{ link.revision }} · {{ link.warning }}
              </p>
            }
          </details>
          @if (d.record.kind === 'export') {
            <button (click)="state.markdown()" [disabled]="state.busy()">
              Download original Markdown
            </button>
          }
          @if (d.record.kind === 'draft') {
            <label
              >Destination campaign<select
                aria-label="Destination campaign"
                [(ngModel)]="destination"
                [disabled]="state.busy()"
              >
                <option value="">Choose explicitly</option>
                @for (c of campaigns(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select></label
            >
            <button (click)="state.copy(destination)" [disabled]="!destination || state.busy()">
              Copy to campaign
            </button>
          }
          @if (state.copied(); as copied) {
            <button (click)="openCopy(copied.campaign, copied.id)">Open copied draft</button>
          }
        </article>
      }
    </main>
  `,
  styles: `
    main {
      max-width: 70rem;
      margin: auto;
      padding: 1.5rem;
      line-height: 1.6;
    }
    section,
    article,
    nav {
      margin: 1rem 0;
      padding: 1rem;
      border: 1px solid var(--muted);
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    label {
      display: block;
      margin: 0.5rem 0;
    }
    button,
    select {
      padding: 0.5rem;
      margin: 0.25rem;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    ul {
      max-height: 22rem;
      overflow: auto;
    }
  `,
})
export class RecoveryWorkspace implements OnDestroy {
  readonly artwork = inject(WritingArtwork);
  readonly state = inject(RecoveryState);
  readonly router = inject(Router);
  readonly campaigns = signal<{ id: string; name: string }[]>([]);
  readonly full = signal(false);
  readonly types = [
    'All',
    'npc',
    'location',
    'faction',
    'item',
    'scene',
    'adventure',
    'handout',
    'reference',
  ];
  backupCampaign = '';
  destination = '';
  constructor() {
    const api = inject(CampaignControllerService);
    void firstValueFrom(api.listCampaigns())
      .then((list) => this.campaigns.set(list.campaigns))
      .catch(() =>
        this.state.error.set('Cannot load destination campaigns. Return to Writing and retry.'),
      );
    void this.state.load();
  }
  upload(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (file) void this.state.restore(file);
    input.value = '';
  }
  async openCopy(campaign: string, draft: string) {
    await this.router.navigate(['/writing'], { queryParams: { campaign, draft } });
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.state.busy()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  ngOnDestroy() {
    this.state.deactivate();
  }
}
