import { Component, input, output, signal, viewChild } from '@angular/core';
import { AuthoredPreview, CheckedLink } from '../../api/generated';
import { ReaderPresentation } from '../shared/reader/reader-presentation';
import { ReaderControls } from '../shared/reader/reader-controls';

@Component({
  selector: 'draft-reader',
  imports: [ReaderPresentation, ReaderControls],
  template: `
    <reader-controls [reader]="reader" />
    <div
      [readerPresentation]="preview()"
      [content]="preview()"
      [sections]="preview()?.sections ?? []"
      [typed]="!!preview()?.classification?.metadata"
      #reader="readerPresentation"
      (click)="follow($event)"
    >
      @for (section of preview()?.sections ?? []; track section.id) {
        <section [attr.data-section]="section.id">
          @for (block of section.blocks; track block.id) {
            <div [innerHTML]="block.html"></div>
          }
        </section>
      }
    </div>
    @if (notice()) {
      <p role="status">{{ notice() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      overflow-wrap: anywhere;
      line-height: 1.7;
    }
    :host ::ng-deep pre,
    :host ::ng-deep table {
      overflow: auto;
      display: block;
    }
    :host ::ng-deep a {
      color: var(--accent);
    }
    :host ::ng-deep h1,
    :host ::ng-deep h2,
    :host ::ng-deep h3 {
      font-family: Georgia, serif;
    }
    p {
      color: var(--muted);
    }
  `,
})
export class DraftReader {
  readonly preview = input<AuthoredPreview | null>(null);
  readonly checkedLinks = input<CheckedLink[]>([]);
  readonly followTarget = output<CheckedLink>();
  readonly presentation = viewChild(ReaderPresentation);
  readonly notice = signal('');
  follow(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    if (!anchor) return;
    event.preventDefault();
    const link = this.preview()?.links.find((l) => anchor.getAttribute('href') === `#${l.key}`);
    const checked = this.checkedLinks().find((l) => l.key === link?.key);
    if (checked && ['source', 'draft'].includes(checked.kind)) {
      this.notice.set('');
      this.followTarget.emit(checked);
      return;
    }
    if (!link || (link.unavailable && checked?.kind !== 'self')) {
      this.notice.set(
        checked?.warning
          ? `Target unavailable. ${checked.warning}`
          : 'Target unavailable in this preview.',
      );
      return;
    }
    this.notice.set('');
    if (link.external) {
      window.open(link.external, '_blank', 'noopener,noreferrer');
      return;
    }
    const slug = checked?.kind === 'self' ? checked.anchor : link.anchor;
    const section = slug ? this.preview()?.anchors[slug] : this.preview()?.sections[0]?.id;
    const target = [
      ...(event.currentTarget as Element).querySelectorAll<HTMLElement>('[data-section]'),
    ].find((el) => el.dataset['section'] === section);
    if (target) {
      this.presentation()?.revealElement(target);
      target.tabIndex = -1;
      target.focus();
      target.scrollIntoView({ block: 'center' });
    }
  }
}
