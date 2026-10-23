import { Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface ArtworkSource {
  key: string;
  load: () => Observable<Blob>;
}

/** Owns only presentation and bounded, visible Blob lifetimes. Transport belongs to features. */
@Component({
  selector: 'artwork-image',
  template: `
    <img
      [src]="local() || url() || '/card-placeholder.svg'"
      draggable="false"
      [alt]="local() || url() ? 'Card artwork' : 'Default card artwork'"
      (error)="imageFailed()"
    />
    @if (state() === 'loading') {
      <span class="state" role="status">Loading artwork…</span>
    }
    @if (state() === 'failed') {
      <button
        type="button"
        (pointerdown)="$event.stopPropagation()"
        (mousedown)="$event.stopPropagation()"
        (touchstart)="$event.stopPropagation()"
        (click)="$event.stopPropagation(); retry()"
      >
        Artwork unavailable · Retry
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: var(--artwork-fit, cover);
      object-position: center;
    }
    .state,
    button {
      position: absolute;
      bottom: var(--artwork-message-bottom, 0);
      left: 0;
      right: 0;
      background: #18251eee;
      color: #fff;
      font: 11px system-ui;
      padding: 3px;
      border: 0;
    }
    button {
      cursor: pointer;
    }
  `,
})
export class ArtworkImage {
  readonly source = input<ArtworkSource | null>(null);
  readonly local = input<string | null>(null);
  readonly url = signal<string | null>(null);
  readonly state = signal<'placeholder' | 'loading' | 'ready' | 'failed'>('placeholder');
  private readonly visible = signal(false);
  private readonly attempt = signal(0);
  private readonly identity = computed(() => this.source(), {
    equal: (a, b) => a?.key === b?.key,
  });
  constructor() {
    const host = inject(ElementRef<HTMLElement>);
    effect((cleanup) => {
      if (typeof IntersectionObserver === 'undefined') {
        this.visible.set(true);
        return;
      }
      const observer = new IntersectionObserver(([entry]) =>
        this.visible.set(entry.isIntersecting),
      );
      observer.observe(host.nativeElement);
      cleanup(() => observer.disconnect());
    });
    effect((cleanup) => {
      const source = this.identity();
      const visible = this.visible();
      const local = this.local();
      this.attempt();
      this.url.set(null);
      this.state.set('placeholder');
      if (!source || !visible || local) return;
      this.state.set('loading');
      let url: string | null = null;
      const subscription = source.load().subscribe({
        next: (blob) => {
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(blob);
          this.url.set(url);
          this.state.set('ready');
        },
        error: () => this.state.set('failed'),
      });
      cleanup(() => {
        subscription.unsubscribe();
        if (url) URL.revokeObjectURL(url);
      });
    });
  }
  retry() {
    this.attempt.update((n) => n + 1);
  }
  imageFailed() {
    if (this.url() || this.local()) this.state.set('failed');
  }
}
