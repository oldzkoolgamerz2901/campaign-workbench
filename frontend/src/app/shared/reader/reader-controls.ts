import { Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ReaderPresentation } from './reader-presentation';

@Component({
  selector: 'reader-controls',
  imports: [MatButtonModule],
  template: `
    @if (reader().headings().length) {
      <div class="reader-actions">
        <button matButton (click)="reader().expandAll()">Expand all</button>
        @for (heading of reader().headings(); track heading.key; let index = $index) {
          @if (heading.collapsible) {
            <button
              matButton
              (click)="reader().toggle(index)"
              [attr.aria-expanded]="!reader().collapsed().has(index)"
              [attr.aria-controls]="heading.controls"
            >
              {{ reader().collapsed().has(index) ? 'Show ' : 'Hide ' }}{{ heading.title.trim() }}
            </button>
          }
        }
        @if (quick() >= 0) {
          <button matButton (click)="reader().go(quick())">Quick reference</button>
        }
        @if (reader().focused() !== null) {
          <button matButton (click)="reader().showFull()">Show full document</button
          ><span role="status">Focused: {{ reader().headings()[reader().focused()!].title }}</span>
        }
      </div>
      <details class="document-outline">
        <summary>Document outline</summary>
        <nav aria-label="Document outline">
          <ol>
            @for (heading of reader().headings(); track heading.key; let index = $index) {
              <li [style.padding-left.rem]="(heading.level - 1) * 0.6">
                <button
                  matButton
                  (click)="reader().go(index)"
                  [attr.aria-current]="reader().active() === index ? 'location' : null"
                >
                  {{ heading.title }}
                </button>
                <button
                  matButton
                  (click)="reader().focus(index)"
                  [disabled]="!reader().canFocus()"
                  [attr.aria-label]="'Focus section: ' + heading.title"
                >
                  Focus
                </button>
                @if (heading.collapsible) {
                  <button
                    matButton
                    (click)="reader().toggle(index)"
                    [attr.aria-expanded]="!reader().collapsed().has(index)"
                    [attr.aria-controls]="heading.controls"
                    [attr.aria-label]="
                      (reader().collapsed().has(index) ? 'Expand: ' : 'Collapse: ') + heading.title
                    "
                  >
                    {{ reader().collapsed().has(index) ? 'Expand' : 'Collapse' }}
                  </button>
                }
              </li>
            }
          </ol>
        </nav>
      </details>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 72ch;
      margin: 0.5rem auto;
    }
    .reader-actions {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .document-outline {
      border-block: 1px solid #8885;
      padding: 0.4rem 0;
    }
    summary {
      font: 0.8rem system-ui;
      cursor: pointer;
    }
    nav {
      max-height: 220px;
      overflow: auto;
    }
    ol {
      list-style: none;
      padding: 0;
      margin: 0.3rem 0;
    }
    li {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.1rem;
    }
    li button:first-child {
      text-align: left;
      flex: 1;
      justify-content: flex-start;
    }
    li button[aria-current] {
      font-weight: bold;
      text-decoration: underline;
    }
    [role='status'] {
      font-size: 0.7rem;
    }
  `,
})
export class ReaderControls {
  readonly reader = input.required<ReaderPresentation>();
  readonly quick = computed(() =>
    this.reader().typed()
      ? this.reader()
          .headings()
          .findIndex((h) => h.title.trim().replace(/\s+/g, ' ').toLowerCase() === 'quick reference')
      : -1,
  );
}
