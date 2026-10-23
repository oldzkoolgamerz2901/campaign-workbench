import { Component, inject, input, OnDestroy, InjectionToken } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { LibraryState } from './library-state';

export type FilterState = Pick<
  LibraryState,
  'filters' | 'query' | 'selected' | 'changeQuery' | 'search' | 'setFilters'
>;
export const LIBRARY_FILTER_STATE = new InjectionToken<FilterState>('Library filters', {
  providedIn: 'root',
  factory: () => inject(LibraryState),
});

@Component({
  selector: 'library-filters',
  imports: [FormsModule, MatButtonModule],
  template: `
    <fieldset class="controls" [disabled]="!ready()">
      <form (ngSubmit)="search()">
        <label class="query"
          >{{ searchLabel() }}
          <input
            type="search"
            name="query"
            [ngModel]="query"
            (ngModelChange)="changeQuery($event)"
            placeholder="Search full content…"
          />
        </label>
        <label class="type"
          >Type
          <select
            aria-label="Library type"
            name="type"
            [ngModel]="state.filters().types[0] ?? ''"
            (ngModelChange)="selectType($event)"
          >
            <option value="">All types</option>
            @for (type of types; track type) {
              <option [value]="type">{{ type === 'npc' ? 'NPC' : type }}</option>
            }
          </select>
        </label>
        <button matButton type="submit">Search</button>
        @if (query) {
          <button matButton type="button" (click)="clear()">Clear search</button>
        }
      </form>
    </fieldset>
  `,
  styles: `
    :host {
      display: block;
      flex: 1;
      min-width: 0;
    }
    .controls {
      border: 0;
      margin: 0;
      padding: 0;
      min-width: 0;
    }
    form {
      display: flex;
      align-items: end;
      flex-wrap: wrap;
      gap: 0.5rem;
      min-width: 0;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.75rem;
      min-width: 0;
    }
    .query {
      flex: 1 1 180px;
    }
    .type {
      flex: 0 1 130px;
    }
    input,
    select {
      box-sizing: border-box;
      width: 100%;
      height: 36px;
      padding: 0.4rem 0.5rem;
    }
    button {
      height: 36px;
    }
  `,
})
export class LibraryFiltersControl implements OnDestroy {
  readonly state = inject(LIBRARY_FILTER_STATE);
  readonly ready = input(true);
  readonly searchLabel = input('Search sources');
  readonly types = [
    'npc',
    'location',
    'faction',
    'item',
    'scene',
    'adventure',
    'handout',
    'reference',
  ];
  private timer?: ReturnType<typeof setTimeout>;
  get query() {
    return this.state.query();
  }
  changeQuery(value: string) {
    this.state.changeQuery(value);
    clearTimeout(this.timer);
    const campaign = this.state.selected()?.id;
    this.timer = setTimeout(() => {
      if (campaign === this.state.selected()?.id && this.query === value)
        void this.state.search(value);
    }, 250);
  }
  search() {
    clearTimeout(this.timer);
    void this.state.search(this.query);
  }
  clear() {
    clearTimeout(this.timer);
    void this.state.search('');
  }
  selectType(type: string) {
    clearTimeout(this.timer);
    void this.state.setFilters({ types: type ? [type] : [] });
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
}
