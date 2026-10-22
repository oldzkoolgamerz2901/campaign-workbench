import { Component, input, output } from '@angular/core';
import { ArtworkImage, ArtworkSource } from '../artwork/artwork-image';

@Component({
  selector: 'playing-card',
  imports: [ArtworkImage],
  template: `
    <article
      class="card"
      [class.selectable]="selectable()"
      [class.selected]="selected()"
      [attr.aria-label]="
        selectable() ? 'Read: ' + (selectionLabel() || title()) : 'Playing card preview'
      "
      [attr.tabindex]="selectable() && !disabled() ? 0 : null"
      [attr.aria-current]="selectable() && selected() ? 'true' : null"
      [attr.aria-disabled]="selectable() && disabled() ? 'true' : null"
      (click)="selectCard($event)"
      (keydown)="activate($event)"
    >
      <div class="card-actions" data-card-actions><ng-content select="[cardActions]" /></div>
      <div class="card-top">
        <span>{{ type() || 'Untyped' }}</span
        ><span>CAMPAIGN WORKBENCH</span>
      </div>
      <artwork-image [source]="artwork()" [local]="localArtwork()" />
      <h3 tabindex="0">{{ title() || 'Untitled card' }}</h3>
      <div class="card-text" tabindex="0" aria-label="Card summary and tags">
        @if (summary().trim()) {
          <p>{{ summary() }}</p>
        } @else {
          <p class="missing">No summary yet. Add one to describe this card.</p>
        }
        <ul aria-label="Card tags">
          @for (tag of tags(); track $index) {
            <li>{{ tag }}</li>
          }
        </ul>
      </div>
      <button
        type="button"
        [disabled]="disabled()"
        (mousedown)="$event.stopPropagation()"
        (touchstart)="$event.stopPropagation()"
        (click)="openDocument.emit()"
      >
        Open full document <span aria-hidden="true">↗</span>
      </button>
    </article>
  `,
  styles: `
    :host {
      display: block;
      width: min(100%, var(--card-width, 320px));
      margin: auto;
      container-type: inline-size;
    }
    .card {
      position: relative;
      aspect-ratio: 243 / 420;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: clamp(0.4rem, 3.25cqi, 0.65rem);
      padding: clamp(0.5rem, 5cqi, 1rem);
      border: 2px solid #aa9567;
      border-radius: clamp(0.5rem, 5cqi, 1rem);
      background: #e9dfc5;
      color: #28352b;
      box-shadow: 0 12px 28px #0004;
      overflow: hidden;
    }
    .selectable {
      cursor: grab;
    }
    .selected {
      border-color: #e8bf65;
      box-shadow:
        0 0 0 2px #e8bf65,
        0 12px 28px #0004;
    }
    .selectable:focus-visible {
      outline: 3px solid #e8bf65;
      outline-offset: 3px;
    }
    h3:focus-visible,
    .card-text:focus-visible,
    button:focus-visible {
      outline: 2px solid #526b45;
      outline-offset: 2px;
    }
    .card-actions {
      position: absolute;
      top: 0.35rem;
      right: 0.35rem;
      z-index: 1;
    }
    .selectable .card-top {
      padding-right: 1.8rem;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      gap: clamp(0.25rem, 2.5cqi, 0.5rem);
      font-size: clamp(0.55rem, 3cqi, 0.6rem);
      letter-spacing: 0.07em;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    artwork-image {
      display: block;
      width: 100%;
      height: var(--card-artwork-height, 35%);
      object-fit: cover;
      border: 1px solid #aa9567;
      border-radius: 0.3rem;
      flex-shrink: 0;
    }
    h3 {
      font:
        clamp(1.1rem, 7.25cqi, 1.45rem) Georgia,
        serif;
      margin: 0;
      overflow-wrap: anywhere;
      max-height: 3.3em;
      overflow: auto;
      flex-shrink: 0;
    }
    .card-text {
      min-height: 0;
      flex: 1;
      overflow: auto;
      overflow-wrap: anywhere;
      font-size: clamp(0.75rem, 4.25cqi, 0.85rem);
      line-height: 1.5;
      padding-right: 0.3rem;
    }
    p {
      white-space: pre-wrap;
      margin: 0 0 0.7rem;
    }
    .missing {
      font-style: italic;
      color: #59614f;
    }
    ul {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      padding: 0;
      margin: 0;
    }
    li {
      border: 1px solid #a49d80;
      border-radius: 1rem;
      padding: 0.12rem 0.5rem;
      font-size: clamp(0.65rem, 3.5cqi, 0.7rem);
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    button {
      border: 0;
      border-top: 1px solid #b4ac91;
      background: transparent;
      color: inherit;
      padding: 0.65rem 0 0;
      display: flex;
      justify-content: space-between;
      font: inherit;
      font-size: clamp(0.75rem, 4cqi, 0.8rem);
      cursor: pointer;
      flex-shrink: 0;
    }
  `,
})
export class PlayingCard {
  readonly artwork = input<ArtworkSource | null>(null);
  readonly localArtwork = input<string | null>(null);
  readonly title = input('');
  readonly type = input('');
  readonly summary = input('');
  readonly tags = input<string[]>([]);
  readonly openDocument = output<void>();
  readonly selectable = input(false);
  readonly selectionLabel = input('');
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly select = output<void>();
  selectCard(event: MouseEvent) {
    if (!this.selectable() || this.disabled()) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, [data-card-actions]')) return;
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
