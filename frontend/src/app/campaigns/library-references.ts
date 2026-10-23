import { Component, effect, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { LibraryEntry, ArtworkControllerService } from '../../api/generated';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { ArtworkImage, ArtworkSource } from '../shared/artwork/artwork-image';
import { LibraryFiltersControl, LIBRARY_FILTER_STATE } from './library-filters';
import { UnifiedLibraryState } from './unified-library-state';
import { REFERENCE_LIBRARY_STATE } from './library-references-state';

@Component({
  selector: 'library-references',
  imports: [MatButtonModule, LibraryFiltersControl, PlayingCard, ArtworkImage],
  providers: [{ provide: LIBRARY_FILTER_STATE, useExisting: REFERENCE_LIBRARY_STATE }],
  template: `
    <section aria-label="Library references">
      <library-filters searchLabel="Search Library references" [ready]="!!campaign()" />
      <button matButton (click)="state.reload()">Reload references</button>
      @if (state.error()) {
        <p role="alert">{{ state.error() }}</p>
      }
      <div class="reference-list" tabindex="0" aria-label="Reference results">
        @for (entry of state.entries(); track entry.key) {
          <div class="reference-row">
            <artwork-image [source]="artwork(entry, 'THUMBNAIL')" />
            <button
              matButton
              [attr.aria-current]="state.selectedEntry()?.key === entry.key ? 'true' : null"
              (click)="state.open(entry)"
            >
              {{ entry.title }} · {{ entry.classification?.metadata?.type ?? 'Unclassified' }}
            </button>
          </div>
        } @empty {
          <p>No references match. Search all to include incomplete documents and saved drafts.</p>
        }
      </div>
      @if (state.selectedEntry(); as entry) {
        <playing-card
          [title]="entry.title ?? ''"
          [type]="entry.classification?.metadata?.type ?? ''"
          [summary]="entry.classification?.metadata?.summary ?? ''"
          [tags]="entry.classification?.metadata?.tags ?? []"
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
                busy() || state.blocked() || state.adding() || state.loading() || !state.session()
              "
              (click)="add()"
            >
              Add selected card to session
            </button>
          }
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
      max-height: 220px;
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
    .reference-row button {
      white-space: normal;
      text-align: left;
      height: auto;
      padding: 0.5rem;
    }
  `,
})
export class LibraryReferences {
  readonly state = inject(REFERENCE_LIBRARY_STATE);
  private readonly api = inject(ArtworkControllerService);
  readonly campaign = input.required<string>();
  readonly session = input('');
  readonly allowAdd = input(false);
  readonly busy = input(false);
  readonly openDocument = output<LibraryEntry>();
  readonly prepared = output<string>();
  readonly added = output<void>();
  async add() {
    await this.state.add();
    if (this.state.notice() && !this.state.error()) this.added.emit();
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
