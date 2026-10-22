import { ArtworkImage } from '../shared/artwork/artwork-image';
import { WritingArtwork } from '../writing/artwork-sources';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WritingControllerService, DraftData, DraftPreview } from '../../api/generated';
import { DraftReader } from '../writing/draft-reader';
import { PlayingCard } from '../shared/playing-card/playing-card';

@Component({
  selector: 'session-draft-chooser',
  imports: [ArtworkImage, PlayingCard, DraftReader],
  template: `
    <section aria-label="Drafts for session">
      <h3>Drafts · {{ destination() || 'Open a session to prepare a draft' }}</h3>
      <p>
        Approve a saved revision for this session. Metadata status and campaign files stay
        unchanged.
      </p>
      <button (click)="load()" [disabled]="busy() || loading()">Reload saved drafts</button>
      <nav aria-label="Draft types">
        @for (type of ['All', ...types()]; track type) {
          <button (click)="group.set(type)" [attr.aria-pressed]="group() === type">
            {{ type }}
          </button>
        }
      </nav>
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <p>Loading saved drafts…</p>
      }
      <ul>
        @for (draft of visible(); track draft.id) {
          <li style="position:relative">
            <artwork-image
              [source]="artwork.draft(draft, 'THUMBNAIL')"
              style="position:absolute;left:8px;top:8px;width:var(--draft-thumbnail-width, 64px);height:var(--draft-thumbnail-height, 80px)"
            />
            <button
              (click)="select(draft)"
              [disabled]="busy()"
              [attr.aria-pressed]="selected()?.id === draft.id"
              style="padding-left:calc(var(--draft-thumbnail-width, 64px) + 24px)"
            >
              {{ draft.fields.title || 'Untitled draft' }} · {{ draft.fields.type }} · revision
              {{ draft.revision }}
            </button>
          </li>
        } @empty {
          <li>No saved drafts in this group.</li>
        }
      </ul>
      @if (selected(); as draft) {
        <p>
          Saved revision {{ draft.revision }} · {{ draft.fields.status }} · {{ draft.fields.path }}
        </p>
        <nav aria-label="Draft presentation">
          <button [attr.aria-pressed]="!bodyOpen()" (click)="bodyOpen.set(false)">Card</button>
          <button [attr.aria-pressed]="bodyOpen()" (click)="bodyOpen.set(true)">Document</button>
        </nav>
        @if (bodyOpen()) {
          <draft-reader [preview]="preview()?.preview ?? null" />
        } @else {
          <playing-card
            [artwork]="artwork.draft(draft)"
            [title]="draft.fields.title"
            [type]="draft.fields.type"
            [tags]="draft.fields.tags"
            [summary]="draft.fields.summary"
            (openDocument)="bodyOpen.set(true)"
          />
        }
        @if (preview(); as checked) {
          @for (issue of checked.preview.classification.issues ?? []; track $index) {
            <p>{{ issue.message }}</p>
          }
          @for (issue of checked.pathIssues; track $index) {
            <p>{{ issue }}</p>
          }
          @for (link of checked.checkedLinks ?? []; track $index) {
            @if (link.warning) {
              <p>{{ link.warning }}</p>
            }
          }
        }
        <p>
          Links open only matching material frozen into this session. Missing targets remain
          unavailable.
        </p>
        <button [disabled]="busy() || !destination() || !ready()" (click)="approve.emit(draft)">
          Approve revision {{ draft.revision }} and add
        </button>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    button {
      padding: 0.5rem;
      cursor: pointer;
    }
    [aria-pressed='true'] {
      font-weight: bold;
    }
    li {
      list-style: none;
      margin: 0.4rem 0;
    }
    li button {
      width: 100%;
      text-align: left;
      min-height: 92px;
    }
    li img {
      float: left;
      object-fit: cover;
      margin-right: 0.7rem;
      border-radius: 4px;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      max-height: 25rem;
      overflow: auto;
    }
  `,
})
export class DraftChooser {
  readonly artwork = inject(WritingArtwork);
  private readonly api = inject(WritingControllerService);
  readonly campaign = input.required<string>();
  readonly destination = input('');
  readonly busy = input(false);
  readonly approve = output<DraftData>();
  readonly drafts = signal<DraftData[]>([]);
  readonly types = signal<string[]>([]);
  readonly group = signal('All');
  readonly selected = signal<DraftData | null>(null);
  readonly preview = signal<DraftPreview | null>(null);
  readonly loading = signal(false);
  readonly bodyOpen = signal(true);
  readonly error = signal('');
  readonly visible = computed(() =>
    this.drafts().filter((d) => this.group() === 'All' || d.fields.type === this.group()),
  );
  readonly ready = computed(() => {
    const p = this.preview();
    return (
      !!p?.preview.classification.metadata &&
      !(p.preview.classification.issues ?? []).some((i) => i.severity === 'error') &&
      !p.pathIssues.length
    );
  });
  private generation = 0;
  private selection = 0;
  constructor() {
    effect(() => {
      this.campaign();
      void this.load();
    });
  }
  async load() {
    const campaign = this.campaign(),
      generation = ++this.generation;
    this.selection++;
    this.selected.set(null);
    this.preview.set(null);
    this.drafts.set([]);
    this.group.set('All');
    this.error.set('');
    this.loading.set(true);
    try {
      const list = await firstValueFrom(
        this.api.listDrafts(campaign, 'body', false, { httpHeaderAccept: 'application/json' }),
      );
      if (generation !== this.generation || campaign !== this.campaign()) return;
      this.drafts.set(list.drafts);
      this.types.set(list.catalog.types);
    } catch {
      if (generation === this.generation) this.error.set('Cannot load saved drafts. Retry reload.');
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async select(draft: DraftData) {
    const generation = this.generation,
      selection = ++this.selection;
    this.selected.set(draft);
    this.preview.set(null);
    this.bodyOpen.set(true);
    this.error.set('');
    try {
      const preview = await firstValueFrom(
        this.api.previewDraft(draft.campaign, draft.id, draft.fields, 'body', false, {
          httpHeaderAccept: 'application/json',
        }),
      );
      if (
        generation === this.generation &&
        selection === this.selection &&
        draft.campaign === this.campaign()
      )
        this.preview.set(preview);
    } catch {
      if (generation === this.generation && selection === this.selection)
        this.error.set('Cannot check this draft. Select it again to retry.');
    }
  }
}
