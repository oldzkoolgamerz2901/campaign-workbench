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
import type { LayoutStats } from '../../../api/generated';
import { StatsReader } from './stats-reader';
import type { CardLayout } from '../../../api/generated/model/cardLayout';
import { CARD_LAYOUT_CLIENT } from '../card-layout/layout-client';
import { ArtworkImage, ArtworkSource } from '../artwork/artwork-image';
import { CardLayoutRenderer, LayoutStatus } from '../card-layout/card-layout-renderer';

@Component({
  selector: 'playing-card',
  imports: [ArtworkImage, CardLayoutRenderer, StatsReader],
  templateUrl: './playing-card.html',
  styleUrl: './playing-card.css',
})
export class PlayingCard implements OnDestroy {
  readonly documentAvailable = input(true);
  readonly artwork = input<ArtworkSource | null>(null);
  readonly localArtwork = input<string | null>(null);
  readonly detailsImage = input<ArtworkSource | null>(null);
  readonly localDetailsImage = input<string | null>(null);
  readonly title = input('');
  readonly type = input('');
  readonly summary = input('');
  readonly quote = input('');
  readonly textVisible = signal(true);
  readonly tags = input<string[]>([]);
  readonly backText = input('');
  readonly stats = input<LayoutStats | null>(null);
  readonly backRevealed = input(true);
  /** Stable owner-provided identity/revision/location; never a workspace mutation revision. */
  readonly context = input('');
  /** Stable displayed-card identity; revision changes must not reset visibility. */
  readonly visibilityKey = input('');
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
  readonly detailsAvailable = computed(() =>
    this.detailsImage() !== null || this.localDetailsImage() !== null || this.layout()?.back.overflow || this.layout()?.back.fits === false ||
    !['ready', 'checking'].includes(this.status()),
  );
  private detailsOpener?: HTMLElement;
  private readonly api = inject(CARD_LAYOUT_CLIENT);
  private readonly reader = viewChild<ElementRef<HTMLDialogElement>>('sideReader');
  private readonly flipButton = viewChild<ElementRef<HTMLButtonElement>>('flipButton');
  private midpoint?: ReturnType<typeof setTimeout>;
  private finish?: ReturnType<typeof setTimeout>;
  readonly content = computed(() =>
    JSON.stringify({
      title: this.title(),
      type: this.type(),
      summary: this.backRevealed() ? this.summary() : '',
      quote: this.quote(),
      tags: this.backRevealed() ? this.tags() : [],
      backText: this.backRevealed() ? this.backText() : 'Back not revealed',
      stats: this.backRevealed() ? this.stats() : null,
    }),
  );

  private readonly orientationContext = computed(() =>
    JSON.stringify([this.context(), this.selected(), this.artwork()?.key, this.localArtwork()]),
  );

  private readonly detailsIdentity = computed(() => JSON.stringify([this.detailsImage()?.key, this.localDetailsImage()]));

  constructor() {
    effect(() => {
      this.visibilityKey() || this.context();
      this.textVisible.set(true);
    });
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
      this.detailsIdentity();
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
  toggleText(event: Event) {
    event.stopPropagation();
    if (!this.disabled()) this.textVisible.update((visible) => !visible);
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
  showDetails(event: Event) {
    event.stopPropagation();
    this.detailsOpener = event.currentTarget as HTMLElement;
    this.reader()?.nativeElement.showModal();
  }
  closeDetails() {
    this.reader()?.nativeElement.close();
    this.restoreDetailsFocus();
  }
  restoreDetailsFocus() {
    if (this.detailsOpener?.isConnected) this.detailsOpener.focus();
    else this.flipButton()?.nativeElement.focus();
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
