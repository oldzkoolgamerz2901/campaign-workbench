import { Component, input, output } from '@angular/core';

@Component({
  selector: 'playing-card',
  template: `
    <article class="card" aria-label="Playing card preview">
      <div class="card-top">
        <span>{{ type() || 'Untyped' }}</span
        ><span>CAMPAIGN WORKBENCH</span>
      </div>
      <img
        src="/card-placeholder.svg"
        alt="Default card illustration: a compass over distant mountains"
      />
      <h3>{{ title() || 'Untitled card' }}</h3>
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
      <button type="button" (click)="openDocument.emit()">
        Open full document <span aria-hidden="true">↗</span>
      </button>
    </article>
  `,
  styles: `
    :host {
      display: block;
      width: min(100%, 320px);
      margin: auto;
    }
    .card {
      aspect-ratio: 5/7;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 1rem;
      border: 2px solid #aa9567;
      border-radius: 1rem;
      background: #e9dfc5;
      color: #28352b;
      box-shadow: 0 12px 28px #0004;
      overflow: hidden;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.6rem;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    img {
      display: block;
      width: 100%;
      height: 35%;
      object-fit: cover;
      border: 1px solid #aa9567;
      border-radius: 0.3rem;
      flex-shrink: 0;
    }
    h3 {
      font:
        1.45rem Georgia,
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
      font-size: 0.85rem;
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
      font-size: 0.7rem;
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
      font-size: 0.8rem;
      cursor: pointer;
      flex-shrink: 0;
    }
  `,
})
export class PlayingCard {
  readonly title = input('');
  readonly type = input('');
  readonly summary = input('');
  readonly tags = input<string[]>([]);
  readonly openDocument = output<void>();
}
