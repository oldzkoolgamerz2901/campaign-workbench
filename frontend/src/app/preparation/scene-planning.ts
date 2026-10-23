import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  PreparedItemData,
  SessionData,
  SessionLibraryControllerService,
  SessionLibraryEntry,
} from '../../api/generated';
import { SessionState } from './session-state';

@Component({
  selector: 'preparation-planning',
  imports: [MatButtonModule],
  template: `
    <button matButton [disabled]="disabled()" (click)="retry.update(increment)">
      Check for updates
    </button>
    @if (state.error()) {
      <button matButton [disabled]="disabled()" (click)="state.reload()">
        Reload saved session
      </button>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button matButton (click)="retry.update(increment)">Retry update status</button>
    }
    @if (match(); as latest) {
      @if (preparedMatch()?.updateAvailable) {
        <section aria-label="Prepared update">
          <strong>Update available</strong>
          <button
            matButton
            [disabled]="disabled() || !preparedMatch()?.canUpdate"
            (click)="replace()"
          >
            Use latest version
          </button>
          @if (!preparedMatch()?.canUpdate) {
            <p>
              The latest saved document has invalid metadata, an identity conflict or a changed card
              type. Correct it in Write before updating this prepared card.
            </p>
          }
          @for (issue of latest.entry.classification?.issues; track $index) {
            <p>{{ issue.message }}</p>
          }
        </section>
      }
    }
    @if (planning() && validScene()) {
      <section aria-label="Scene planning">
        <h3>Related prepared cards</h3>
        <p>Link cards already in this session. They appear in preparation order during Play.</p>
        @for (card of session().items; track card.id) {
          @if (card.id !== item().id) {
            <div class="scene-target">
              <button
                matButton
                [disabled]="disabled()"
                [attr.aria-pressed]="linked(card.id)"
                (click)="state.changeSceneLink(item().id, card.id, !linked(card.id))"
              >
                {{ linked(card.id) ? 'Unlink: ' : 'Link: ' }}{{ card.title }}
              </button>
              @if (linked(card.id)) {
                <button matButton (click)="inspect.emit(card.id)">
                  Read related: {{ card.title }}
                </button>
              }
            </div>
          }
        }
        @if (session().items.length < 2) {
          <p>Add other cards from Library before linking them.</p>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .scene-target {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      border-bottom: 1px solid #94896c;
      padding: 0.4rem 0;
    }
    [aria-pressed='true'] {
      background: #d4ceb7;
    }
  `,
})
export class ScenePlanning {
  readonly state = inject(SessionState);
  private readonly api = inject(SessionLibraryControllerService);
  readonly session = input.required<SessionData>();
  readonly item = input.required<PreparedItemData>();
  readonly planning = input(false);
  readonly disabled = input(false);
  readonly inspect = output<string>();
  readonly retry = signal(0);
  readonly increment = (value: number) => value + 1;
  readonly error = signal('');
  readonly match = signal<SessionLibraryEntry | null>(null);
  readonly capture = signal<string | null>(null);
  readonly preparedMatch = computed(() =>
    this.match()?.matches.find((m) => m.item === this.item().id),
  );
  readonly validScene = computed(
    () =>
      this.item().capturedSource?.classification?.metadata?.type === 'scene' &&
      !this.item().capturedSource?.classification?.issues?.some((i) => i.severity === 'error'),
  );
  private readonly requestKey = computed(
    () =>
      `${this.session().campaign}:${this.session().id}:${this.session().revision}:${this.item().id}`,
  );
  constructor() {
    effect((cleanup) => {
      this.requestKey();
      this.retry();
      const session = untracked(this.session),
        item = untracked(this.item);
      this.match.set(null);
      this.error.set('');
      const subscription = this.api
        .listSessionLibraryCards(
          session.campaign,
          session.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          false,
          false,
          'body',
          false,
          { httpHeaderAccept: 'application/json' },
        )
        .subscribe({
          next: (result) => {
            this.capture.set(result.capture);
            this.match.set(
              result.entries.find((e) => e.matches.some((m) => m.item === item.id)) ?? null,
            );
          },
          error: () =>
            this.error.set(
              'Cannot check for a newer saved document. Your frozen card is unchanged.',
            ),
        });
      cleanup(() => subscription.unsubscribe());
    });
  }
  linked(id: string) {
    return this.session().sceneLinks.some((l) => l.scene === this.item().id && l.item === id);
  }
  async replace() {
    const entry = this.match()?.entry;
    if (entry && this.preparedMatch()?.canUpdate)
      await this.state.replaceFromLibrary(this.item().id, entry, this.capture());
  }
}
