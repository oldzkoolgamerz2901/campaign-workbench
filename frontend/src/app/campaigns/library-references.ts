import { Component, effect, inject, input, output, OnDestroy } from '@angular/core';
import { LibraryAdventure } from './library-adventure';
import { MatButtonModule } from '@angular/material/button';
import { LibraryEntry, ArtworkControllerService } from '../../api/generated';
import { CardFitFeedback } from '../shared/card-layout/card-fit-feedback';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { ArtworkImage, ArtworkSource } from '../shared/artwork/artwork-image';
import { LibraryFiltersControl, LIBRARY_FILTER_STATE } from './library-filters';
import { UnifiedLibraryState } from './unified-library-state';
import { REFERENCE_LIBRARY_STATE } from './library-references-state';

@Component({
  selector: 'library-references',
  imports: [
    MatButtonModule,
    LibraryFiltersControl,
    PlayingCard,
    CardFitFeedback,
    ArtworkImage,
    LibraryAdventure,
  ],
  providers: [{ provide: LIBRARY_FILTER_STATE, useExisting: REFERENCE_LIBRARY_STATE }],
  template: `
    <section aria-label="Library references">
      <library-filters
        searchLabel="Search Library references"
        [ready]="!!campaign() && !state.assemblyRunning()"
      />
      <button matButton (click)="state.reload()" [disabled]="state.assemblyRunning()">
        Reload references
      </button>
      @if (state.error()) {
        <p role="alert">{{ state.error() }}</p>
      }
      @if (state.loading()) {
        <p role="status">Loading references…</p>
      }
      <div class="reference-list" tabindex="0" aria-label="Reference results">
        @for (entry of state.entries(); track entry.key) {
          <div class="reference-row">
            <artwork-image [source]="artwork(entry, 'THUMBNAIL')" />
            <div class="reference-info">
              <button
                matButton
                [attr.aria-current]="state.selectedEntry()?.key === entry.key ? 'true' : null"
                (click)="state.open(entry)"
                [disabled]="state.assemblyRunning()"
              >
                {{ entry.title }} · {{ entry.classification?.metadata?.type ?? 'Unclassified' }}
              </button>
              <small
                >{{ entry.classification?.metadata?.status ?? 'No valid metadata' }} ·
                {{ entry.ready ? 'Ready to prepare' : 'Not preparable' }}</small
              >
              @if (!entry.classification?.metadata || entry.classification?.issues?.length) {
                <small>Incomplete / classification issues</small>
              }
              @if (entry.conflicts?.length) {
                <small>Identity conflict</small>
              }
            </div>
          </div>
        } @empty {
          <p>No references match the search and type.</p>
        }
      </div>
      @if (state.selectedEntry(); as entry) {
        @if (state.stale()) {
          <p>Selected document changed. Reload it before adding.</p>
          <button matButton (click)="state.reopen()" [disabled]="state.assemblyRunning()">
            Reload selected document
          </button>
        }
        <card-fit-feedback [issues]="entry.fitIssues ?? []" />
        @if (!entry.ready || entry.conflicts?.length) {
          <p>
            Preparation blocked. Correct incomplete metadata in Write or resolve identity conflicts.
          </p>
        }
        <playing-card
          [title]="entry.title ?? ''"
          [type]="entry.classification?.metadata?.type ?? ''"
          [summary]="entry.classification?.metadata?.summary ?? ''"
          [tags]="entry.classification?.metadata?.tags ?? []"
          [backText]="entry.classification?.metadata?.backText ?? ''"
          [context]="
            campaign() + ':' + entry.key + ':' + entry.revision + ':' + state.documentCapture()
          "
          [artwork]="artwork(entry)"
          (openDocument)="openDocument.emit(entry)"
        />
        @if (allowAdd()) {
          @if (state.status()?.matches?.length) {
            <p>
              {{
                state.status()?.state === 'UPDATE_AVAILABLE'
                  ? 'Prepared · Update available'
                  : 'Already in session'
              }}
            </p>
            @for (match of state.status()?.matches; track match.item; let i = $index) {
              <button matButton [disabled]="busy()" (click)="prepared.emit(match.item)">
                View prepared card{{
                  state.status()!.matches.length > 1 ? ' · copy ' + (i + 1) : ''
                }}
              </button>
            }
          } @else {
            <button
              matButton
              [disabled]="
                busy() ||
                state.blocked() ||
                state.adding() ||
                state.assemblyRunning() ||
                state.loading() ||
                !state.session()
              "
              (click)="add()"
            >
              Add selected card to session
            </button>
          }
          <library-adventure [state]="state" [busy]="busy()" (added)="added.emit($event)" />
          @if (state.notice()) {
            <p role="status">{{ state.notice() }}</p>
          }
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .reference-list {
      max-height: var(--reference-results-max-height, 220px);
      overflow: auto;
      margin: 0.7rem 0;
    }
    .reference-row {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }
    .reference-row artwork-image {
      width: 30px;
      height: 40px;
      flex-shrink: 0;
    }
    .reference-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .reference-info small {
      padding: 0 0.5rem;
      color: var(--muted);
    }
    .reference-row button {
      white-space: normal;
      text-align: left;
      height: auto;
      padding: 0.5rem;
    }
  `,
})
export class LibraryReferences implements OnDestroy {
  readonly state = inject(REFERENCE_LIBRARY_STATE);
  private readonly api = inject(ArtworkControllerService);
  readonly campaign = input.required<string>();
  readonly session = input('');
  readonly allowAdd = input(false);
  readonly busy = input(false);
  readonly openDocument = output<LibraryEntry>();
  readonly prepared = output<string>();
  readonly added = output<{ campaign: string; session: string }>();
  private active = true;
  async add() {
    const destination = { campaign: this.campaign(), session: this.session() };
    await this.state.add();
    if (
      this.active &&
      destination.campaign === this.campaign() &&
      destination.session === this.session()
    )
      this.added.emit(destination);
  }
  ngOnDestroy() {
    this.active = false;
    this.state.detach();
  }
  constructor() {
    effect(() => {
      void this.state.bind(this.campaign(), this.session());
    });
  }
  artwork(entry: LibraryEntry, variant: 'DISPLAY' | 'THUMBNAIL' = 'DISPLAY'): ArtworkSource | null {
    const campaign = this.campaign(),
      draft = entry.draft;
    return entry.image && draft
      ? {
          key: `reference:${campaign}:${draft}:${entry.image.hash}:${variant}`,
          load: () => this.api.getDraftArtwork(campaign, draft, variant),
        }
      : null;
  }
}
