import {
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
  ElementRef,
  effect,
  afterNextRender,
  Injector,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { SessionData, ResourceSnapshot, PlayNoteData } from '../../api/generated';
import { PlayNotesState } from './play-notes-state';
import { PlayWorkspaceState } from './workspace-state';
import { NoteMarkdown } from './note-markdown';
import { PlayHistory } from './play-history';
import { PlayHistoryState } from './play-history-state';

@Component({
  selector: 'play-notes',
  providers: [PlayHistoryState],
  imports: [FormsModule, MatButtonModule, DatePipe, NoteMarkdown, PlayHistory],
  template: `
    <nav class="note-views" aria-label="Notes views">
      @for (tab of views; track tab.id) {
        <button
          matButton
          [attr.aria-pressed]="view() === tab.id"
          [attr.aria-controls]="'notes-' + session().id + '-' + tab.id"
          (click)="showView(tab.id)"
        >
          {{ tab.title }}
        </button>
      }
    </nav>
    @if (notes.loading()) {
      <p role="status">Loading PlayNotes…</p>
    }
    @if (notes.error()) {
      <p role="alert">{{ notes.error() }}</p>
    }
    @if (
      view() !== 'live' &&
      (notes.status() === 'failed' || notes.uncertain() || notes.contextConflict())
    ) {
      <p role="status" class="review-status">
        A PlayNote needs review.
        <button matButton (click)="showView('live')">Review Live note</button>
      </p>
    }
    <section
      data-notes-view="live"
      [id]="'notes-' + session().id + '-live'"
      aria-label="Live notes"
      [hidden]="view() !== 'live'"
    >
      <h3 tabindex="-1">Live notes</h3>
      <p class="muted">
        {{ notes.editing() ? 'Edit captured note' : 'New note' }} · Scene:
        {{ notes.hasUnsaved() || notes.editing() ? notes.sceneTitle() : currentSceneTitle() }}
      </p>
      <label
        >Primary resource
        <select
          aria-label="Primary resource"
          [ngModel]="notes.resource()"
          (ngModelChange)="notes.setResource($event, currentSceneTitle())"
          [disabled]="!notes.ready(session().campaign, session().id) || notes.locked()"
        >
          <option [ngValue]="null">
            {{
              notes.editing() && !notes.changeResource()
                ? 'Keep captured association'
                : 'No primary resource'
            }}
          </option>
          @for (item of session().items; track item.id) {
            <option [value]="item.id">{{ item.title }} · {{ $index + 1 }}</option>
          }
        </select>
      </label>
      @if (notes.editing()) {
        <p>Captured resource: {{ notes.editing()?.resource?.title ?? 'None' }}</p>
        <button
          matButton
          (click)="notes.setResource(null, currentSceneTitle())"
          [disabled]="!notes.ready(session().campaign, session().id) || notes.locked()"
        >
          Clear primary association
        </button>
        <label
          ><input
            type="checkbox"
            [ngModel]="notes.pinned()"
            (ngModelChange)="notes.setPinned($event)"
            [disabled]="!notes.ready(session().campaign, session().id) || notes.locked()"
          />
          Pinned</label
        >
      }
      <label
        >PlayNote Markdown<textarea
          rows="5"
          [ngModel]="notes.text()"
          (ngModelChange)="notes.setText($event, currentSceneTitle())"
          [disabled]="!notes.ready(session().campaign, session().id) || notes.locked()"
        ></textarea>
      </label>
      <div class="actions">
        <button
          matButton
          (click)="notes.save()"
          [disabled]="
            !notes.ready(session().campaign, session().id) ||
            notes.busy() ||
            notes.contextConflict() ||
            !notes.text().trim()
          "
        >
          {{ notes.status() === 'failed' ? 'Retry PlayNote save' : 'Save PlayNote' }}
        </button>
        <button matButton (click)="notes.discard()" [disabled]="notes.busy()">
          {{ notes.editing() ? 'New note / cancel edit' : 'Discard draft' }}
        </button>
      </div>
      @if (notes.uncertain()) {
        <p role="status">
          Save delivery is unconfirmed. Retry the retained save, or reload history to inspect what
          was saved.
          <button matButton (click)="showView('history')">Review saved history</button>
        </p>
      }
      @if (notes.contextConflict()) {
        <button matButton (click)="notes.useCurrentScene(sceneTitle)">
          Refresh and use current Scene
        </button>
      }
      @if (notes.text()) {
        <details>
          <summary>Markdown preview</summary>
          <play-note-markdown [campaign]="session().campaign" [markdown]="notes.text()" />
        </details>
      }
      <section aria-label="Recent PlayNotes" class="recent-notes">
        <h4>Recent notes</h4>
        @for (note of notes.notes().slice(0, 5); track note.id) {
          <button
            matButton
            class="recent-note"
            [attr.data-note-id]="note.id"
            (click)="edit(note)"
            [disabled]="notes.busy()"
            [attr.aria-label]="'Edit recent note: ' + note.markdown.slice(0, 100)"
          >
            <span>{{ note.markdown.slice(0, 120) }}</span>
            <small>{{ note.createdAt | date: 'short' }}{{ note.pinned ? ' · Pinned' : '' }}</small>
          </button>
        } @empty {
          <p class="muted">No PlayNotes yet.</p>
        }
        <button matButton (click)="showView('history')">View full history</button>
      </section>
    </section>
    <section
      data-notes-view="preparation"
      [id]="'notes-' + session().id + '-preparation'"
      aria-label="Preparation references"
      [hidden]="view() !== 'preparation'"
    >
      <h3 tabindex="-1">Preparation</h3>
      <ng-content select="[preparationNotes]" />
    </section>
    <section
      data-notes-view="history"
      [id]="'notes-' + session().id + '-history'"
      aria-label="Notes history"
      [hidden]="view() !== 'history'"
    >
      <h3 tabindex="-1">History</h3>
      @if (notes.status() === 'failed' && notes.editing()) {
        <button matButton (click)="reviewEdited()" [disabled]="notes.busy()">
          Reload saved revision for review
        </button>
      }
      <play-history [session]="session()" />
      <button matButton (click)="notes.reloadHistory()" [disabled]="notes.loading()">
        Reload note history
      </button>
      @if (pins().length) {
        <section aria-label="Pinned PlayNotes">
          <h4>Pinned</h4>
          @for (note of pins().slice(0, visible()); track note.id) {
            <button matButton (click)="edit(note)">
              {{ note.markdown.slice(0, 100) }} · {{ note.createdAt | date: 'short' }}
            </button>
          }
        </section>
      }
      <section aria-label="PlayNote chronology">
        <h4>Session chronology</h4>
        @for (note of notes.notes().slice(0, visible()); track note.id) {
          <article class="play-note" [attr.data-note-id]="note.id">
            <p>{{ note.createdAt | date: 'short' }}{{ note.pinned ? ' · Pinned' : '' }}</p>
            <p class="muted">
              Scene: {{ note.scene?.title ?? 'None' }} · Resource:
              {{ note.resource?.title ?? 'None' }}
            </p>
            <play-note-markdown [campaign]="session().campaign" [markdown]="note.markdown" />
            @if (note.resource; as resource) {
              <button matButton (click)="openHistory(resource, 'resource')">
                Resource history: {{ resource.title }}
              </button>
            }
            @if (note.scene; as scene) {
              <button matButton (click)="openHistory(scene, 'scene')">
                Scene history: {{ scene.title }}
              </button>
            }
            <button matButton (click)="edit(note)">Edit / pin note</button>
          </article>
        } @empty {
          <p class="muted">No PlayNotes yet.</p>
        }
        @if (notes.notes().length > visible() || pins().length > visible()) {
          <button matButton (click)="visible.set(visible() + 20)">Show more notes</button>
        }
      </section>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    label {
      display: block;
      margin: 0.6rem 0;
    }
    textarea,
    select {
      width: 100%;
      box-sizing: border-box;
      color: #29392c;
      background: #f1ecdf;
      border-color: #9ca588;
      color-scheme: light;
    }
    textarea {
      resize: vertical;
      min-height: 7rem;
    }
    .play-note {
      border-top: 1px solid #8885;
      margin-top: 1rem;
      padding-top: 0.5rem;
    }
    .muted {
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
    }
    .note-views {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      position: sticky;
      top: 0;
      z-index: 2;
      background: #e9e6d6;
      padding: 4px 0;
      border-bottom: 1px solid #8885;
    }
    .note-views button {
      min-width: 0;
      padding-inline: 7px;
      font-size: 0.8rem;
    }
    .note-views [aria-pressed='true'] {
      background: #cdcbb7;
    }
    .recent-notes {
      margin-top: 1rem;
      border-top: 1px solid #8885;
    }
    .recent-note {
      display: block;
      width: 100%;
      text-align: start;
      height: auto;
      padding: 8px;
    }
    .recent-note span,
    .recent-note small {
      display: block;
      overflow-wrap: anywhere;
    }
    .recent-note small {
      font-size: 0.75rem;
      opacity: 0.8;
    }
    h3:focus-visible {
      outline: 2px solid #526b45;
      outline-offset: 2px;
    }
    .review-status {
      font-size: 0.85rem;
    }
  `,
})
export class PlayNotesPanel {
  readonly session = input.required<SessionData>();
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly view = signal<'live' | 'preparation' | 'history'>('live');
  readonly views = [
    { id: 'live', title: 'Live notes' },
    { id: 'preparation', title: 'Preparation' },
    { id: 'history', title: 'History' },
  ] as const;
  private sessionIdentity = '';
  constructor() {
    effect(() => {
      const key = this.session().campaign + ':' + this.session().id;
      if (key !== this.sessionIdentity) {
        this.sessionIdentity = key;
        this.view.set('live');
        this.visible.set(20);
      }
    });
  }
  showView(view: 'live' | 'preparation' | 'history') {
    if (this.view() === view) return;
    this.view.set(view);
    const session = this.sessionIdentity;
    afterNextRender(
      () => {
        if (this.view() === view && this.sessionIdentity === session)
          this.host.nativeElement
            .querySelector<HTMLElement>(`[data-notes-view="${view}"] > h3`)
            ?.focus();
      },
      { injector: this.injector },
    );
  }
  edit(note: PlayNoteData) {
    this.notes.select(note);
    if (this.notes.editing() === note && !this.notes.hasUnsaved()) {
      this.showView('live');
      afterNextRender(
        () => {
          if (this.view() === 'live' && this.notes.editing() === note)
            this.host.nativeElement.querySelector<HTMLTextAreaElement>('textarea')?.focus();
        },
        { injector: this.injector },
      );
    }
  }
  async reviewEdited() {
    const previous = this.notes.editing();
    await this.notes.reloadEdited();
    if (this.notes.editing() !== previous && this.notes.status() === 'pending')
      this.showView('live');
  }
  private readonly historyElement = viewChild(PlayHistory, { read: ElementRef });
  async openHistory(target: ResourceSnapshot, kind: 'resource' | 'scene') {
    this.showView('history');
    const session = this.sessionIdentity;
    await this.history.show(target, kind);
    if (
      this.view() === 'history' &&
      this.sessionIdentity === session &&
      this.history.target() === target &&
      this.history.kind() === kind
    )
      this.historyElement()?.nativeElement.scrollIntoView({ block: 'nearest' });
  }
  readonly notes = inject(PlayNotesState);
  readonly history = inject(PlayHistoryState);
  readonly play = inject(PlayWorkspaceState);
  readonly visible = signal(20);
  readonly pins = computed(() => this.notes.notes().filter((n) => n.pinned));
  readonly sceneTitle = (id: string | null) =>
    this.session().items.find((i) => i.id === id)?.title ?? 'No active Scene';
  currentSceneTitle() {
    return this.sceneTitle(this.play.current()?.activeSceneItemId ?? null);
  }
}
