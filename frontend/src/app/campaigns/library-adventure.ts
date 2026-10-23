import { Component, computed, effect, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { UnifiedLibraryState } from './unified-library-state';

/** Shared explicit whole-card selection; mutations use the normal Library contract. */
@Component({
  selector: 'library-adventure',
  imports: [MatButtonModule],
  styles: `
    :host {
      display: block;
    }
    section {
      padding: 0.75rem;
      border: 1px solid var(--line);
    }
    label {
      display: block;
      margin: 0.5rem 0;
      overflow-wrap: anywhere;
    }
    input {
      width: auto;
    }
  `,
  template: `
    @if (state().document()?.entry?.classification?.metadata?.type === 'adventure') {
      <button
        matButton
        (click)="expanded.set(!expanded())"
        [disabled]="state().assemblyRunning() || busy()"
      >
        Choose adventure material
      </button>
      @if (expanded()) {
        <section aria-label="Adventure material chooser">
          <p>
            Select complete cards. Heading links add the whole Scene. Existing prepared versions
            stay frozen.
          </p>
          @for (choice of choices(); track $index; let i = $index) {
            <label
              ><input
                type="checkbox"
                [checked]="selected().includes(i)"
                (change)="toggle(i)"
                [disabled]="!!choice.problem || state().assemblyRunning() || busy()"
              />
              {{ choice.entry?.title ?? choice.destination }}{{ i === 0 ? ' · Overview' : '' }}
              @if (choice.problem) {
                <span> · {{ choice.problem }}</span>
              }
            </label>
          }
          <button
            matButton
            (click)="start()"
            [disabled]="
              busy() ||
              state().blocked() ||
              state().adding() ||
              state().assemblyRunning() ||
              !selected().length ||
              !state().session()
            "
          >
            Add selected material
          </button>
          @if (state().assembly().length) {
            <ol aria-label="Adventure addition progress" aria-live="polite">
              @for (item of state().assembly(); track item.entry.key) {
                <li>{{ item.entry.title }} — {{ item.status }}</li>
              }
            </ol>
            @if (state().assemblyRunning()) {
              <p role="status">Adding selected material…</p>
            } @else if (unfinished()) {
              <p>
                Completed cards remain saved. Retry checks the destination before adding unfinished
                cards.
              </p>
              <button matButton (click)="retry()" [disabled]="busy()">
                Retry remaining material
              </button>
            }
          }
        </section>
      }
    }
  `,
})
export class LibraryAdventure {
  readonly state = input.required<UnifiedLibraryState>();
  readonly busy = input(false);
  readonly added = output<{ campaign: string; session: string }>();
  readonly expanded = signal(false);
  readonly selected = signal<number[]>([0]);
  readonly choices = computed(() => {
    const doc = this.state().document();
    return doc?.entry
      ? [
          {
            entry: doc.entry,
            destination: 'Overview',
            problem: doc.entry.ready ? null : 'Adventure is not ready for preparation.',
          },
          ...(doc.adventureChoices ?? []),
        ]
      : [];
  });
  readonly unfinished = computed(() =>
    this.state()
      .assembly()
      .some((item) => item.status !== 'completed'),
  );
  constructor() {
    effect(() => {
      this.state().document();
      this.expanded.set(false);
      this.selected.set([0]);
    });
  }
  toggle(index: number) {
    this.selected.update((items) =>
      items.includes(index) ? items.filter((i) => i !== index) : [...items, index],
    );
  }
  async start() {
    const state = this.state(),
      destination = { campaign: state.campaign(), session: state.session() };
    const entries = this.choices()
      .filter((choice, i) => this.selected().includes(i) && !choice.problem)
      .flatMap((choice) => (choice.entry ? [choice.entry] : []));
    if (await state.startAssembly(entries)) this.added.emit(destination);
  }
  async retry() {
    const state = this.state(),
      destination = { campaign: state.campaign(), session: state.session() };
    if (await state.retryAssembly()) this.added.emit(destination);
  }
}
