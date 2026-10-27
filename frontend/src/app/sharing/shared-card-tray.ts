import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  signal,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { ArtworkSource } from '../shared/artwork/artwork-image';
import type { SharedCardData } from '../../api/generated/model/sharedCardData';

@Component({
  selector: 'shared-card-tray',
  imports: [PlayingCard],
  template: ` <div class="tray">
      @for (card of cards(); track card.id) {
        <div class="entry">
          <playing-card
            [title]="card.visible.title"
            [type]="card.visible.type"
            [summary]="card.visible.summary"
            [tags]="card.visible.tags"
            [backText]="card.visible.backText"
            [context]="card.id"
            [artwork]="artwork()(card)"
            [documentAvailable]="false"
            [selectable]="true"
            [selectionLabel]="'Expand ' + card.visible.title"
            (select)="open(card.id, $event)"
          />
          <small>{{ card.mode === 'HANDOUT' ? 'Handout' : 'Inventory' }}</small>
        </div>
      } @empty {
        <p>No shared cards in Unsorted.</p>
      }
    </div>
    <dialog #expanded aria-label="Expanded card" (close)="closed()" (click)="close()">
      @if (current(); as card) {
        <playing-card
          [title]="card.visible.title"
          [type]="card.visible.type"
          [summary]="card.visible.summary"
          [tags]="card.visible.tags"
          [backText]="card.visible.backText"
          [context]="card.id"
          [artwork]="artwork()(card)"
          [documentAvailable]="false"
        />
      }
      <button type="button" (click)="close()">Close expanded card</button>
    </dialog>`,
  styles: `
    .tray {
      display: flex;
      gap: 1rem;
      overflow: auto;
      padding: 1rem 0;
      align-items: start;
    }
    .entry {
      flex: 0 0 243px;
      width: 243px;
    }
    small {
      display: block;
      margin-top: 0.4rem;
      color: var(--muted);
    }
    dialog {
      width: min(440px, calc(100vw - 2rem));
      max-height: 90dvh;
      overflow: auto;
      padding: 1rem;
      background: var(--panel);
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    dialog::backdrop {
      background: #000b;
    }
    button {
      margin-top: 0.6rem;
      min-height: 44px;
    }
    @media (max-width: 450px) {
      .entry {
        flex-basis: 220px;
        width: 220px;
      }
    }
  `,
})
export class SharedCardTray implements OnDestroy {
  readonly cards = input.required<SharedCardData[]>();
  readonly artwork = input.required<(card: SharedCardData) => ArtworkSource | null>();
  readonly identity = input('');
  private readonly selected = signal('');
  readonly current = computed(() => this.cards().find((card) => card.id === this.selected()));
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('expanded');
  private target: HTMLElement | null = null;
  private previousOverflow: string | null = null;
  constructor() {
    effect(() => {
      this.identity();
      this.close();
    });
    effect(() => {
      if (!this.current()) this.close();
    });
  }
  open(id: string, _event: unknown) {
    this.target = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.selected.set(id);
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.dialog()?.nativeElement.showModal();
  }
  close() {
    this.dialog()?.nativeElement.close();
  }
  closed() {
    this.selected.set('');
    this.restoreScroll();
    if (this.target?.isConnected) this.target.focus();
  }
  private restoreScroll() {
    if (this.previousOverflow !== null) {
      document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    }
  }
  ngOnDestroy() {
    this.restoreScroll();
  }
}
