import { Component, effect, inject, input, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { SessionData } from '../../api/generated';
import { PlayHistoryState } from './play-history-state';
import { NoteMarkdown } from './note-markdown';

@Component({
  selector: 'play-history',
  imports: [FormsModule, RouterLink, MatButtonModule, NoteMarkdown],
  template: `
    <button
      matButton
      (click)="history.expanded.set(!history.expanded())"
      [attr.aria-expanded]="history.expanded()"
    >
      Card history across sessions
    </button>
    @if (history.expanded()) {
      <section aria-label="Cross-session card history">
        <h4>Card history across sessions</h4>
        <label
          >Prepared copy
          <select
            aria-label="History prepared copy"
            [ngModel]="history.selectedItem()"
            (ngModelChange)="history.choose($event)"
          >
            <option value="">Choose a prepared copy</option>
            @for (target of history.targets(); track target.item) {
              <option [value]="target.item">{{ target.resource.title }} · {{ $index + 1 }}</option>
            }
          </select>
        </label>
        @if (history.targetsLoading()) {
          <p role="status">Loading history targets…</p>
        }
        @if (history.targetsError()) {
          <p role="alert">{{ history.targetsError() }}</p>
          <button matButton (click)="history.reloadTargets()">Retry history targets</button>
        }
        <label
          >History association
          <select
            aria-label="History association"
            [ngModel]="history.kind()"
            (ngModelChange)="history.show(history.target(), $event, true)"
          >
            <option value="resource">Primary resource</option>
            <option value="scene">Captured Scene</option>
          </select>
        </label>
        @if (history.target(); as target) {
          <p>
            {{ target.title }} ·
            {{ history.kind() === 'scene' ? 'Captured Scene' : 'Primary resource' }}
          </p>
          @if (!target.reference) {
            <p>
              This captured title has no stable resource identity. Review its notes through the
              session chronology.
            </p>
          } @else {
            <button
              matButton
              (click)="history.show(target, history.kind(), true)"
              [disabled]="history.loading() || history.pinsLoading()"
            >
              Reload card history
            </button>
            @for (stream of ['pins', 'chronology']; track stream) {
              <section
                [attr.aria-label]="
                  stream === 'pins' ? 'Pinned card history' : 'Card history chronology'
                "
              >
                <h5>{{ stream === 'pins' ? 'Pinned' : 'Full chronology · newest first' }}</h5>
                @if (stream === 'pins' ? history.pinsLoading() : history.loading()) {
                  <p role="status">Loading card history…</p>
                }
                @if (stream === 'pins' ? history.pinsError() : history.error(); as error) {
                  <p role="alert">{{ error }}</p>
                  <button
                    matButton
                    (click)="
                      history.load(
                        stream === 'pins',
                        !!(stream === 'pins' ? history.pinPage() : history.page())
                      )
                    "
                  >
                    Retry card history
                  </button>
                }
                @for (
                  entry of stream === 'pins' ? history.pins() : history.entries();
                  track entry.note.id
                ) {
                  <article class="history-note" [attr.data-history-note-id]="entry.note.id">
                    <p>
                      {{ displayTime(entry.note.createdAt)
                      }}{{ entry.note.pinned ? ' · Pinned' : '' }}
                    </p>
                    <a
                      [routerLink]="['/']"
                      [queryParams]="{
                        campaign: session().campaign,
                        session: entry.note.session,
                        mode: 'play',
                        view: 'prepare',
                      }"
                      >Open session: {{ entry.sessionTitle }}</a
                    >
                    <p>
                      Scene: {{ entry.note.scene?.title ?? 'None' }} · Resource:
                      {{ entry.note.resource?.title ?? 'None' }}
                    </p>
                    <play-note-markdown
                      [campaign]="session().campaign"
                      [markdown]="entry.note.markdown"
                    />
                  </article>
                } @empty {
                  @if (
                    !(stream === 'pins'
                      ? history.pinsLoading() || history.pinsError()
                      : history.loading() || history.error())
                  ) {
                    <p>No matching notes.</p>
                  }
                }
                @if ((stream === 'pins' ? history.pinPage() : history.page())?.nextId) {
                  <button
                    matButton
                    (click)="history.load(stream === 'pins', true)"
                    [disabled]="stream === 'pins' ? history.pinsLoading() : history.loading()"
                  >
                    {{ stream === 'pins' ? 'More pinned history' : 'More card history' }}
                  </button>
                }
              </section>
            }
          }
        } @else {
          <p>Choose a prepared copy or open a captured association from a session note.</p>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }
    select {
      width: 100%;
      color: #29392c;
      background: #f1ecdf;
      color-scheme: light;
    }
    label {
      display: block;
      margin: 0.6rem 0;
    }
    .history-note {
      border-top: 1px solid #8885;
      margin-top: 1rem;
      overflow-wrap: anywhere;
    }
    a {
      color: inherit;
      text-decoration: underline;
    }
  `,
})
export class PlayHistory {
  readonly session = input.required<SessionData>();
  readonly history = inject(PlayHistoryState);
  displayTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
  constructor() {
    effect(() => {
      const session = this.session();
      const campaign = session.campaign,
        id = session.id;
      // Preparation revision changes can replace membership or frozen identity.
      session.revision;
      untracked(() => this.history.open(campaign, id));
    });
  }
}
