import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  PlaythroughControllerService,
  PreparedItemData,
  RelationshipSuggestion,
  WorkspaceData,
} from '../../api/generated';

/** Read composition only; all mutations remain explicit workspace commands. */
@Component({
  selector: 'play-relationship-suggestions',
  template: `
    <section aria-label="Related cards" aria-live="polite" tabindex="0">
      <h3>Related cards</h3>
      @if (loading()) {
        <p>Loading related cards…</p>
      }
      @if (error()) {
        <p>{{ error() }}</p>
        <button type="button" (click)="retry.update(increment)">Retry related cards</button>
      }
      @if (!loading() && !error() && !suggestions().length) {
        <p>No frozen relationships in this scene.</p>
      }
      @for (suggestion of suggestions(); track suggestion.key) {
        <div class="relationship">
          <strong>{{ suggestion.destination }}</strong>
          @if (suggestion.state === 'AMBIGUOUS') {
            <p>Choose a prepared copy:</p>
          }
          @for (candidate of suggestion.candidates; track candidate.item) {
            @if (item(candidate.item); as card) {
              <div class="candidate">
                <span
                  >{{ card.title }} · Prepared {{ position(card.id) }}
                  {{ workspace().used.includes(card.id) ? '· Used' : '' }}</span
                >
                @if (
                  !workspace().focusedItemIds.includes(card.id) &&
                  workspace().focusedItemIds.length < 3
                ) {
                  <button type="button" [disabled]="disabled()" (click)="focusItem.emit(card.id)">
                    Focus: {{ card.title }}
                  </button>
                }
                <button
                  type="button"
                  [disabled]="disabled()"
                  (click)="openTarget.emit('@' + card.id + '#' + (candidate.anchor ?? ''))"
                >
                  Inspect{{ candidate.anchor ? ' section' : '' }}: {{ card.title }}
                </button>
              </div>
            }
          }
          @if (suggestion.state === 'UNPREPARED') {
            <p>Not prepared. Library inspection and capture are not yet available.</p>
          }
          @if (suggestion.state === 'UNAVAILABLE') {
            <p>Unavailable frozen target.</p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    section {
      max-height: 18rem;
      overflow: auto;
    }
    button {
      cursor: pointer;
      color: var(--ink);
      background: #304b39;
      border: 1px solid #829078;
      padding: 0.4rem 0.55rem;
      border-radius: 0.3rem;
      font: inherit;
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }
    button:disabled {
      opacity: 0.55;
      cursor: default;
    }
    button:focus-visible,
    section:focus-visible {
      outline: 3px solid #e8bf65;
      outline-offset: 2px;
    }
    .relationship {
      border-top: 1px solid var(--line, #555);
      padding: 0.5rem 0;
      overflow-wrap: anywhere;
    }
    .candidate {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.4rem;
    }
    p {
      margin: 0.4rem 0;
    }
  `,
})
export class RelationshipSuggestions {
  private readonly api = inject(PlaythroughControllerService);
  readonly campaign = input.required<string>();
  readonly session = input.required<string>();
  readonly workspace = input.required<WorkspaceData>();
  readonly items = input.required<PreparedItemData[]>();
  readonly disabled = input(false);
  readonly focusItem = output<string>();
  readonly openTarget = output<string>();
  readonly suggestions = signal<RelationshipSuggestion[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly scene = computed(() => this.workspace().activeSceneItemId);
  readonly retry = signal(0);
  readonly increment = (value: number) => value + 1;
  constructor() {
    effect((cleanup) => {
      const campaign = this.campaign(),
        session = this.session();
      const scene = this.scene();
      // Membership changes can invalidate exact candidates even when the scene stays active.
      this.items();
      this.retry();
      this.suggestions.set([]);
      this.error.set('');
      this.loading.set(!!scene);
      if (!scene) return;
      const request = this.api
        .playRelationshipSuggestions(campaign, session, scene, 'body', false, {
          httpHeaderAccept: 'application/json',
        })
        .subscribe({
          next: (result) => {
            this.suggestions.set(result.scene === scene ? result.suggestions : []);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('Related cards could not be loaded.');
            this.loading.set(false);
          },
        });
      cleanup(() => request.unsubscribe());
    });
  }
  item(id: string) {
    return this.items().find((item) => item.id === id);
  }
  position(id: string) {
    return this.items().findIndex((item) => item.id === id) + 1;
  }
}
