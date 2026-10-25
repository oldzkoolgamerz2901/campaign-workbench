import { Component, input } from '@angular/core';
import { CardFitIssue } from '../../../api/generated';

@Component({
  selector: 'card-fit-feedback',
  template: `@if (issues().length) {
    <aside aria-label="Card fit feedback" role="status">
      @for (issue of issues(); track $index) {
        <p>{{ message(issue) }}</p>
      }
      <p>
        Fit warnings alone do not prevent saving or exporting. Correct the text in Write before
        adding or updating a session card.
      </p>
    </aside>
  }`,
  styles: `
    aside {
      border-left: 3px solid #b18b42;
      padding-left: 0.75rem;
    }
    p {
      overflow-wrap: anywhere;
    }
  `,
})
export class CardFitFeedback {
  readonly issues = input<CardFitIssue[]>([]);
  message(issue: CardFitIssue) {
    if (issue.code === 'font-unavailable')
      return 'Card fonts are unavailable. Try checking the fit again.';
    const field =
      (
        {
          title: 'Front title',
          type: 'Front type',
          summary: 'Front summary',
          tags: 'Front tags',
          backText: 'Back text',
          card: 'Card text',
        } as Record<string, string>
      )[issue.field] ?? 'Card text';
    if (issue.code === 'unsupported-character')
      return `${field} contains characters the card font cannot display.`;
    return `${field} does not fit on the card.`;
  }
}
