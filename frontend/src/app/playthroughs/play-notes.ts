import { Component, computed, inject, input, signal, viewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { SessionData, ResourceSnapshot } from '../../api/generated';
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
    <h3>PlayNotes</h3>
    <p class="muted">
      {{ notes.editing() ? 'Edit captured note' : 'New note' }} · Scene:
      {{ notes.text() || notes.editing() ? notes.sceneTitle() : currentSceneTitle() }}
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
    @if (notes.error()) {
      <p role="alert">{{ notes.error() }}</p>
    }
    @if (notes.uncertain()) {
      <p role="status">
        Save delivery is unconfirmed. Retry the retained save, or reload history to inspect what was
        saved.
      </p>
    }
    @if (notes.contextConflict()) {
      <button matButton (click)="notes.useCurrentScene(sceneTitle)">
        Refresh and use current Scene
      </button>
    }
    @if (notes.status() === 'failed' && notes.editing()) {
      <button matButton (click)="notes.reloadEdited()" [disabled]="notes.busy()">
        Reload saved revision for review
      </button>
    }
    @if (notes.text()) {
      <details>
        <summary>Markdown preview</summary>
        <play-note-markdown [campaign]="session().campaign" [markdown]="notes.text()" />
      </details>
    }
    <play-history [session]="session()" />
    <button matButton (click)="notes.reloadHistory()" [disabled]="notes.loading()">
      Reload note history
    </button>
    @if (notes.loading()) {
      <p role="status">Loading PlayNotes…</p>
    }
    @if (pins().length) {
      <section aria-label="Pinned PlayNotes">
        <h4>Pinned</h4>
        @for (note of pins().slice(0, visible()); track note.id) {
          <button matButton (click)="notes.select(note)">
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
          <button matButton (click)="notes.select(note)">Edit / pin note</button>
        </article>
      } @empty {
        <p class="muted">No PlayNotes yet.</p>
      }
      @if (notes.notes().length > visible() || pins().length > visible()) {
        <button matButton (click)="visible.set(visible() + 20)">Show more notes</button>
      }
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
  `,
})
export class PlayNotesPanel {
  readonly session = input.required<SessionData>();
  private readonly historyElement = viewChild(PlayHistory, { read: ElementRef });
  async openHistory(target: ResourceSnapshot, kind: 'resource' | 'scene') {
    await this.history.show(target, kind);
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
