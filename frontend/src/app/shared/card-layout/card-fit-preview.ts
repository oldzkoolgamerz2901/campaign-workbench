import { Component, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { CardLayout } from '../../../api/generated';
import { CardLayoutRenderer, LayoutStatus } from './card-layout-renderer';
import { CardFitFeedback } from './card-fit-feedback';

@Component({
  selector: 'card-fit-preview',
  imports: [CardLayoutRenderer, CardFitFeedback, MatButtonModule],
  template: `
    <section aria-label="Physical card fit">
      <h3>Physical card fit</h3>
      <card-fit-feedback [issues]="layout().front.issues.concat(layout().back.issues)" />
      @if (layout().front.fits && layout().back.fits) {
        <p role="status">Both sides fit on the card.</p>
      }
      <nav aria-label="Fit preview side">
        <button
          matButton
          type="button"
          [attr.aria-pressed]="side() === 'front'"
          (click)="side.set('front')"
        >
          Front layout
        </button>
        <button
          matButton
          type="button"
          [attr.aria-pressed]="side() === 'back'"
          (click)="side.set('back')"
        >
          Back layout
        </button>
      </nav>
      <div class="preview">
        <card-layout-renderer
          [showStatus]="false"
          [layout]="layout()"
          [side]="side()"
          [label]="side() === 'front' ? 'Front text layout' : 'Back text layout'"
          (checked)="status.set($event)"
        />
      </div>
      @if (
        status() === 'font-unavailable' ||
        status() === 'profile-mismatch' ||
        status() === 'overflow'
      ) {
        <p role="status">
          The card preview could not be displayed. Your text is preserved; try checking again.
        </p>
      }
      <p>Preview the text on either side. Saving preserves both sides.</p>
    </section>
  `,
  styles: `
    .preview {
      max-width: 320px;
      width: 100%;
      background: #e9dfc5;
      margin: 0.75rem auto;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class CardFitPreview {
  readonly layout = input.required<CardLayout>();
  readonly side = signal<'front' | 'back'>('front');
  readonly status = signal<LayoutStatus>('checking');
}
