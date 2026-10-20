import { Component, effect, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { LibraryState } from '../campaigns/library-state';
import { WritingState } from './writing-state';

@Component({
  selector: 'writing-export-panel',
  imports: [FormsModule, MatButtonModule],
  templateUrl: './writing-export-panel.html',
  styles: `
    :host {
      grid-column: 2 / -1;
      display: block;
      border-top: 1px solid var(--line);
      padding: 1.5rem;
    }
    textarea {
      box-sizing: border-box;
      width: 100%;
      font-family: monospace;
    }
    details,
    p,
    li {
      overflow-wrap: anywhere;
    }
    pre {
      white-space: pre-wrap;
      max-height: 20rem;
      overflow: auto;
    }
    label {
      display: block;
      margin: 1rem 0;
    }
    @media (max-width: 900px) {
      :host {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class WritingExportPanel {
  readonly state = inject(WritingState);
  readonly library = inject(LibraryState);
  readonly recheckSources = output<void>();
  acknowledged = false;
  constructor() {
    effect(() => {
      this.state.inspection();
      this.acknowledged = false;
    });
  }
}
