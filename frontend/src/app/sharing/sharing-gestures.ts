import {
  ElementRef,
  HostListener,
  Directive,
  Injectable,
  effect,
  inject,
  input,
  output,
  signal,
  OnDestroy,
} from '@angular/core';
import { CdkDrag, CDK_DRAG_CONFIG } from '@angular/cdk/drag-drop';
import type { SharedCardData } from '../../api/generated';

export type SharingDrag =
  | { kind: 'source'; id: string }
  | {
      kind: 'card';
      id: string;
      collection: string;
      pile: string | null;
      mode: SharedCardData['mode'];
    };
export interface SharingTarget {
  kind: 'collection' | 'location' | 'claim' | 'remove';
  collection?: string;
  pile?: string | null;
  before?: string;
}
export interface SharingDestination {
  id: string;
  name: string;
  pile?: string;
}
export interface SharingDrop {
  source: SharingDrag;
  target: SharingTarget;
}

@Injectable()
export class SharingGestures {
  readonly active = signal<SharingDrag | null>(null);
  readonly hovered = signal<SharingDropTarget | null>(null);
  readonly targets = new Set<SharingDropTarget>();
  readonly generation = signal(0);
  private suppressedUntil = 0;
  suppressRelease() {
    this.suppressedUntil = Date.now() + 350;
  }
  newPointer() {
    if (!this.active()) this.suppressedUntil = 0;
  }
  cancel() {
    this.generation.update((value) => value + 1);
    this.active.set(null);
    this.hovered.set(null);
  }
  suppressClick(event: Event) {
    // Keyboard activation is independent of the pointer release click.
    if ((event as MouseEvent).detail !== 0 && Date.now() < this.suppressedUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  point(point: { x: number; y: number }) {
    const source = this.active();
    const candidates = source
      ? [...this.targets].filter((t) => t.accepts()(source) && t.contains(point))
      : [];
    // A card insertion target is more specific than its containing tray/pile.
    candidates.sort((a, b) => a.area() - b.area());
    this.hovered.set(candidates[0] || null);
  }
  finish(point: { x: number; y: number }, event: MouseEvent | TouchEvent) {
    this.suppressedUntil = Date.now() + 350;
    this.point(point);
    const source = this.active(),
      target = this.hovered();
    this.cancel();
    if (source && target && event.type !== 'touchcancel')
      target.dropped.emit({ source, target: target.sharingTarget() });
  }
}

@Directive({
  selector: '[sharingTarget]',
  host: {
    '[class.sharing-drop-eligible]': 'gestures.active() && accepts()(gestures.active()!)',
    '[class.sharing-drop-hover]': 'gestures.hovered() === this',
  },
})
export class SharingDropTarget implements OnDestroy {
  readonly sharingTarget = input.required<SharingTarget>();
  readonly accepts = input<(source: SharingDrag) => boolean>(() => false);
  readonly dropped = output<SharingDrop>();
  readonly gestures = inject(SharingGestures);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  constructor() {
    this.gestures.targets.add(this);
  }
  private rect() {
    return this.element.nativeElement.getBoundingClientRect();
  }
  contains(p: { x: number; y: number }) {
    const el = this.element.nativeElement,
      r = this.rect();
    if (!el.checkVisibility() || !r.width || !r.height) return false;
    // Ignore targets behind the currently active native modal or clipped by scrolling.
    const hit = document.elementFromPoint(p.x, p.y);
    const source = this.gestures.active();
    if (
      source &&
      hit?.closest('[data-shared-card]')?.getAttribute('data-shared-card') === source.id
    )
      return false;
    return (
      !!hit &&
      (el === hit || el.contains(hit)) &&
      p.x >= r.left &&
      p.x <= r.right &&
      p.y >= r.top &&
      p.y <= r.bottom
    );
  }
  area() {
    const r = this.rect();
    return r.width * r.height;
  }
  ngOnDestroy() {
    this.gestures.targets.delete(this);
  }
}

@Directive({
  selector: '[sharingDrag]',
  host: { class: 'sharing-drag-source', '[class.sharing-grabbed]': 'grabbed' },
  hostDirectives: [CdkDrag],
  providers: [
    {
      provide: CDK_DRAG_CONFIG,
      useValue: { dragStartThreshold: 8, dragStartDelay: { mouse: 0, touch: 180 } },
    },
  ],
})
export class SharingDragSource implements OnDestroy {
  readonly sharingDrag = input.required<SharingDrag>();
  readonly dragDisabled = input(false);
  private readonly drag = inject(CdkDrag);
  private readonly gestures = inject(SharingGestures);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private holdTimer?: ReturnType<typeof setTimeout>;
  private holdPoint: { x: number; y: number } | null = null;
  private dragging = false;
  private holding = false;
  get grabbed() {
    return this.gestures.active()?.id === this.sharingDrag().id;
  }
  private clearHold() {
    clearTimeout(this.holdTimer);
    this.holdPoint = null;
    this.holding = false;
  }
  @HostListener('pointerdown', ['$event']) hold(event: PointerEvent) {
    this.clearHold();
    if (
      event.pointerType === 'mouse' ||
      !event.isPrimary ||
      this.dragDisabled() ||
      (event.target as HTMLElement).closest('button, input, select, summary, a')
    )
      return;
    const source = { ...this.sharingDrag() };
    const generation = this.gestures.generation();
    this.holdPoint = { x: event.clientX, y: event.clientY };
    this.holdTimer = setTimeout(() => {
      if (
        this.holdPoint &&
        !this.dragDisabled() &&
        generation === this.gestures.generation() &&
        this.element.nativeElement.isConnected &&
        JSON.stringify(source) === JSON.stringify(this.sharingDrag())
      ) {
        this.holding = true;
        this.gestures.active.set(source);
      }
    }, 180);
  }
  @HostListener('document:pointermove', ['$event']) pendingMove(event: PointerEvent) {
    if (
      this.holdPoint &&
      !this.grabbed &&
      Math.hypot(event.clientX - this.holdPoint.x, event.clientY - this.holdPoint.y) > 8
    )
      this.clearHold();
  }
  @HostListener('document:pointerup') releaseHold() {
    const holding = this.holding;
    this.clearHold();
    if (holding && !this.dragging && this.grabbed) {
      this.gestures.suppressRelease();
      this.gestures.cancel();
    }
  }
  @HostListener('document:pointercancel') cancelHold() {
    const holding = this.holding;
    this.clearHold();
    if (holding && !this.dragging && this.grabbed) this.gestures.cancel();
  }
  private readonly subscriptions = [
    this.drag.started.subscribe(() => {
      this.clearHold();
      this.dragging = true;
      this.element.nativeElement
        .querySelector<HTMLElement>('article[tabindex]')
        ?.focus({ preventScroll: true });
      this.gestures.active.set({ ...this.sharingDrag() });
    }),
    this.drag.moved.subscribe((e) => this.gestures.point(e.pointerPosition)),
    this.drag.ended.subscribe((e) => {
      this.dragging = false;
      this.drag.reset();
      this.gestures.finish(e.dropPoint, e.event);
    }),
  ];
  @HostListener('contextmenu', ['$event']) preventNativeMenu(event: Event) {
    if (
      !this.dragDisabled() &&
      !(event.target as HTMLElement).closest('button, input, select, summary')
    )
      event.preventDefault();
  }
  private readonly freshPointer = () => this.gestures.newPointer();
  private readonly capture = (e: Event) => this.gestures.suppressClick(e);
  constructor() {
    this.drag.previewContainer = this.element.nativeElement.closest('dialog') || 'global';
    effect(() => {
      this.drag.disabled = this.dragDisabled();
      if (this.dragDisabled()) this.clearHold();
      const source = this.sharingDrag(),
        active = this.gestures.active();
      if (
        active?.id === source.id &&
        (this.dragDisabled() || JSON.stringify(active) !== JSON.stringify(source))
      )
        this.gestures.cancel();
    });
    this.element.nativeElement.addEventListener('click', this.capture, true);
    this.element.nativeElement.addEventListener('pointerdown', this.freshPointer, true);
  }
  @HostListener('document:pointerdown') newPointer() {
    this.gestures.newPointer();
  }
  @HostListener('document:keydown.escape') cancel() {
    this.clearHold();
    this.dragging = false;
    this.gestures.cancel();
    this.drag.reset();
  }
  ngOnDestroy() {
    this.clearHold();
    if (this.gestures.active()?.id === this.sharingDrag().id) this.gestures.cancel();
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.element.nativeElement.removeEventListener('click', this.capture, true);
    this.element.nativeElement.removeEventListener('pointerdown', this.freshPointer, true);
  }
}
