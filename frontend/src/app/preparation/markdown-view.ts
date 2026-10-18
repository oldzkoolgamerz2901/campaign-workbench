import { Component, input, output, signal, viewChild } from '@angular/core';
import { ReaderPresentation } from '../shared/reader/reader-presentation';
import { ReaderControls } from '../shared/reader/reader-controls';
import { RenderedMarkdown } from '../../api/generated';

@Component({
  selector: 'prepared-markdown',
  imports: [ReaderPresentation, ReaderControls],
  template: `@if (readingTools()) {
      <reader-controls [reader]="presentation" />
    }
    <div
      [readerPresentation]="identity()"
      [content]="content()"
      [anchors]="content()?.anchors ?? []"
      [typed]="typed()"
      [enabled]="readingTools()"
      #presentation="readerPresentation"
      class="markdown"
      (click)="follow($event)"
      [innerHTML]="content()?.html ?? ''"
    ></div>
    @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }`,
  styles: `
    :host {
      display: block;
      overflow-wrap: anywhere;
    }
    .markdown {
      line-height: 1.75;
    }
    :host ::ng-deep pre {
      overflow: auto;
      padding: 1rem;
      background: #0001;
    }
    :host ::ng-deep table {
      display: block;
      overflow: auto;
      border-collapse: collapse;
    }
    :host ::ng-deep td,
    :host ::ng-deep th {
      border: 1px solid #8888;
      padding: 0.5rem;
    }
    :host ::ng-deep a {
      color: inherit;
      text-decoration: underline;
    }
    :host ::ng-deep h1,
    :host ::ng-deep h2,
    :host ::ng-deep h3 {
      font-family: Georgia, serif;
      line-height: 1.25;
    }
    [role='status'] {
      font: 0.85rem system-ui;
      color: var(--muted);
    }
  `,
})
export class MarkdownView {
  readonly content = input<RenderedMarkdown | null>(null);
  readonly readingTools = input(false);
  readonly typed = input(false);
  readonly identity = input('');
  readonly presentation = viewChild(ReaderPresentation);
  revealAnchor(anchor: string) {
    const index = this.content()?.anchors.indexOf(anchor) ?? -1;
    if (index >= 0) this.presentation()?.go(index);
  }
  readonly notice = signal('');
  readonly capturedTarget = output<string>();
  follow(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    if (!anchor) return;
    event.preventDefault();
    const link = this.content()?.links.find((l) => `#${l.key}` === anchor.getAttribute('href'));
    if (!link || link.unavailable) {
      this.notice.set('This target is outside the captured material or unsupported.');
      return;
    }
    if (link.external) {
      window.open(link.external, '_blank', 'noopener,noreferrer');
      return;
    }
    if (link.target?.startsWith('@')) {
      this.capturedTarget.emit(link.target);
      return;
    }
    // Scope duplicate heading IDs to this particular frozen card.
    const index = this.content()?.anchors.indexOf(link.target ?? '') ?? -1;
    const target = (event.currentTarget as Element).querySelectorAll('h1,h2,h3,h4,h5,h6')[index];
    if (target) {
      this.presentation()?.revealElement(target as HTMLElement);
      target.setAttribute('tabindex', '-1');
      target.scrollIntoView({ block: 'center' });
      (target as HTMLElement).focus({ preventScroll: true });
    }
  }
}
