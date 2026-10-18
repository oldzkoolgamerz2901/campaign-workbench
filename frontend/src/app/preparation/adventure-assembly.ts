import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { SourceDocument } from '../../api/generated';
import { LibraryState } from '../campaigns/library-state';
import { SessionState, SourceSelection } from './session-state';

@Component({
  selector: 'adventure-assembly',
  imports: [MatButtonModule],
  template: `
    <section aria-label="Adventure material chooser">
      <header>
        <h3>
          Choose adventure material:
          {{ document().classification?.metadata?.title ?? document().path }}
        </h3>
        <button matButton (click)="close.emit()" [disabled]="state.queueRunning()">Close</button>
      </header>
      <p>
        Select the overview and directly linked scenes to add. Each selection is saved separately.
      </p>
      @for (choice of choices(); track $index) {
        <label
          ><input
            type="checkbox"
            [checked]="selected().includes($index)"
            (change)="toggle($index)"
            [disabled]="started()"
          />{{ choice.title }} · {{ choice.path
          }}{{ choice.section ? ' · section ' + choice.section : '' }}</label
        >
      }
      @if (!started()) {
        <button
          matButton="filled"
          (click)="start()"
          [disabled]="!selected().length || state.queueRunning()"
        >
          Add selected material
        </button>
      } @else {
        <ol aria-label="Adventure addition progress" aria-live="polite">
          @for (addition of state.additions(); track $index) {
            <li>{{ addition.title ?? addition.path }} — {{ addition.status }}</li>
          }
        </ol>
        @if (state.queueRunning()) {
          <p>Adding selected material…</p>
        }
        @if (unfinished() && !state.queueRunning()) {
          <p>
            Saved selections are retained. Retry adds only unfinished selections from the original
            capture.
          </p>
          <button matButton (click)="state.retryAdditions()">Retry remaining material</button>
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    section {
      border: 1px solid var(--line);
      padding: 0.6rem 1rem;
      background: #243b2e;
      max-height: 40vh;
      overflow: auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h3,
    p {
      margin: 0.4rem 0;
    }
    label {
      display: block;
      font-size: 0.8rem;
      margin: 0.3rem 0;
    }
  `,
})
export class AdventureAssembly {
  readonly state = inject(SessionState);
  private readonly library = inject(LibraryState);
  readonly document = input.required<SourceDocument>();
  readonly close = output<void>();
  readonly selected = signal<number[]>([0]);
  readonly started = signal(false);
  readonly unfinished = computed(() =>
    this.state.additions().some((a) => a.status !== 'completed'),
  );
  readonly choices = computed<SourceSelection[]>(() => {
    const doc = this.document();
    const scenes = (doc.relationships ?? [])
      .filter((r) => r.sceneCandidate && r.target?.document && !r.target.missing)
      .map((r) => ({
        path: r.target!.document!,
        section: r.target!.section,
        title: r.classification?.metadata?.title ?? r.target!.document!,
      }));
    return [
      ...new Map(
        [{ path: doc.path, section: null, title: 'Overview' }, ...scenes].map((s) => [
          JSON.stringify([s.path, s.section]),
          s,
        ]),
      ).values(),
    ];
  });
  toggle(index: number) {
    this.selected.update((values) =>
      values.includes(index) ? values.filter((v) => v !== index) : [...values, index],
    );
  }
  async start() {
    const doc = this.document(),
      session = this.state.current();
    if (
      !session ||
      session.campaign !== doc.campaign ||
      this.library.library()?.capture !== doc.capture ||
      this.state.mutating() ||
      this.state.queueRunning()
    )
      return;
    this.started.set(true);
    await this.state.startAdditions(
      doc.capture,
      this.choices().filter((_, index) => this.selected().includes(index)),
    );
  }
}
