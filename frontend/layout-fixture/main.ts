import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { CardLayoutRenderer } from '../src/app/shared/card-layout/card-layout-renderer';
import { CardLayout } from '../src/app/shared/card-layout/card-layout';

@Component({
  selector: 'app-root',
  imports: [CardLayoutRenderer],
  template: `
    <h1>Canonical layout developer fixture</h1>
    @for (fixture of fixtures(); track fixture.name) {
      <section [attr.data-case]="fixture.name">
        <h2>{{ fixture.name }}</h2>
        @for (side of sides; track side) {
          <article [attr.data-side]="side">
            <card-layout-renderer
              [layout]="fixture.layout"
              [side]="side"
              [label]="fixture.name + ' ' + side"
            />
          </article>
        }
      </section>
    }
  `,
  styles: `
    section {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    h2 {
      width: 100%;
    }
    article {
      width: min(320px, calc(100vw - 32px));
      background: #e9dfc5;
      border: 1px solid #aa9567;
    }
  `,
})
class LayoutFixture {
  readonly sides = ['front', 'back'] as const;
  readonly fixtures = signal<{ name: string; layout: CardLayout }[]>([]);
  constructor() {
    void fetch('/fixtures/layouts.json').then(async (response) => {
      if (!response.ok) throw new Error('Generate the backend CardLayoutTest fixtures first');
      this.fixtures.set(await response.json());
    });
  }
}
void bootstrapApplication(LayoutFixture);
