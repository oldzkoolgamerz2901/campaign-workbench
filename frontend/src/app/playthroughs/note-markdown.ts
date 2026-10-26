import { Component, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PreparationControllerService, RenderedMarkdown } from '../../api/generated';
import { MarkdownView } from '../preparation/markdown-view';

@Component({
  selector: 'play-note-markdown',
  imports: [MarkdownView],
  template: `<prepared-markdown [content]="rendered()" />
    @if (error()) {
      <p role="status">Preview unavailable.</p>
      <pre>{{ markdown() }}</pre>
    }`,
})
export class NoteMarkdown {
  readonly campaign = input.required<string>();
  readonly markdown = input.required<string>();
  readonly rendered = signal<RenderedMarkdown | null>(null);
  readonly error = signal(false);
  private readonly api = inject(PreparationControllerService);
  constructor() {
    effect((onCleanup) => {
      const campaign = this.campaign(),
        markdown = this.markdown();
      let active = true;
      this.rendered.set(null);
      this.error.set(false);
      const timer = setTimeout(async () => {
        if (!markdown) return;
        try {
          const result = await firstValueFrom(
            this.api.previewMarkdown(campaign, { markdown }, 'body', false, {
              httpHeaderAccept: 'application/json',
            }),
          );
          if (active) this.rendered.set(result);
        } catch {
          if (active) this.error.set(true);
        }
      }, 250);
      onCleanup(() => {
        active = false;
        clearTimeout(timer);
      });
    });
  }
}
