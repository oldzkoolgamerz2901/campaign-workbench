import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  OnDestroy,
} from '@angular/core';
import type { CardLayout } from '../../../api/generated/model/cardLayout';
import { CARD_LAYOUT_CLIENT } from '../card-layout/layout-client';
import { ArtworkImage, ArtworkSource } from '../artwork/artwork-image';
import { CardLayoutRenderer, LayoutStatus } from '../card-layout/card-layout-renderer';

@Component({
  selector: 'playing-card',
  imports: [ArtworkImage, CardLayoutRenderer],
  templateUrl: './playing-card.html',
  styleUrl: './playing-card.css',
})
export class PlayingCard implements OnDestroy {
  readonly documentAvailable = input(true);
  readonly artwork = input<ArtworkSource | null>(null);
  readonly localArtwork = input<string | null>(null);
  readonly title = input('');
  readonly type = input('');
  readonly summary = input('');
  readonly tags = input<string[]>([]);
  readonly backText = input('');
  /** Stable owner-provided identity/revision/location; never a workspace mutation revision. */
  readonly context = input('');
  readonly openDocument = output<void>();
  readonly selectable = input(false);
  readonly selectionLabel = input('');
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly select = output<void>();
  readonly side = signal<'front' | 'back'>('front');
  readonly animating = signal(false);
  readonly layout = signal<CardLayout | null>(null);
  readonly status = signal<LayoutStatus | 'unavailable'>('checking');
  readonly readingSide = signal<'front' | 'back'>('front');
  private readonly api = inject(CARD_LAYOUT_CLIENT);
  private readonly reader = viewChild<ElementRef<HTMLDialogElement>>('sideReader');
  private readonly flipButton = viewChild<ElementRef<HTMLButtonElement>>('flipButton');
  private midpoint?: ReturnType<typeof setTimeout>;
  private finish?: ReturnType<typeof setTimeout>;
  readonly content = computed(() =>
    JSON.stringify({
      title: this.title(),
      type: this.type(),
      summary: this.summary(),
      tags: this.tags(),
      backText: this.backText(),
    }),
  );

  private readonly orientationContext = computed(() =>
    JSON.stringify([this.context(), this.selected(), this.artwork()?.key, this.localArtwork()]),
  );

  constructor() {
    effect((cleanup) => {
      const content = this.content();
      const context = this.context();
      this.layout.set(null);
      this.status.set('checking');
      const request = this.api.calculate(JSON.parse(content), context).subscribe({
        next: (layout) => this.layout.set(layout),
        error: () => this.status.set('unavailable'),
      });
      cleanup(() => request.unsubscribe());
    });
    effect(() => {
      this.content();
      this.orientationContext();
      this.cancelFlip();
      this.side.set('front');
      this.reader()?.nativeElement.close();
    });
  }
  ngOnDestroy() {
    this.cancelFlip();
  }
  private cancelFlip() {
    clearTimeout(this.midpoint);
    clearTimeout(this.finish);
    this.animating.set(false);
  }
  flip(event: Event) {
    event.stopPropagation();
    if (this.disabled() || this.animating()) return;
    const next = this.side() === 'front' ? 'back' : 'front';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.showSide(next);
      return;
    }
    this.animating.set(true);
    this.midpoint = setTimeout(() => this.showSide(next), 115);
    this.finish = setTimeout(() => this.animating.set(false), 230);
  }
  private showSide(side: 'front' | 'back') {
    this.status.set(this.layout() ? 'checking' : 'unavailable');
    this.side.set(side);
  }
  readSide(event: Event) {
    event.stopPropagation();
    this.readingSide.set(this.side());
    this.reader()?.nativeElement.showModal();
  }
  closeReader() {
    this.reader()?.nativeElement.close();
    this.flipButton()?.nativeElement.focus();
  }
  document(event: Event) {
    event.stopPropagation();
    this.openDocument.emit();
  }
  selectCard(event: MouseEvent) {
    if (!this.selectable() || this.disabled()) return;
    if ((event.target as HTMLElement).closest('button, [data-card-actions]')) return;
    this.select.emit();
  }
  activate(event: KeyboardEvent) {
    if (event.target !== event.currentTarget || !this.selectable() || this.disabled()) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select.emit();
    }
  }
}
