import { Component, ElementRef, inject, input, OnDestroy, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { LibraryState, LibraryFilters } from './library-state';

@Component({
  selector: 'library-filters',
  imports: [FormsModule, MatButtonModule],
  template: `
    <fieldset class="controls" [disabled]="!ready()">
      <nav aria-label="Library categories">
        <button matButton (click)="state.playLibrary()">Play library</button>
        @for (type of types; track type) {
          <button
            matButton
            [attr.aria-pressed]="state.filters().types.includes(type)"
            (click)="toggle('types', type)"
          >
            {{ type === 'npc' ? 'NPC' : type }}
          </button>
        }
        <button matButton (click)="searchAll()">Search all</button>
      </nav>
      <form (ngSubmit)="search()">
        <label
          >Search sources<input
            type="search"
            name="query"
            [ngModel]="query"
            (ngModelChange)="changeQuery($event)"
            placeholder="Search full content…"
        /></label>
        <button matButton type="submit">Search</button>
        @if (query) {
          <button matButton type="button" (click)="clear()">Clear search</button>
        }
        <details #options>
          <summary>Filters</summary>
          <div class="options">
            <label
              >Tags (all required, comma separated)<input
                name="tags"
                [ngModel]="tagText"
                (ngModelChange)="tags($event)"
            /></label>
            <fieldset>
              <legend>Purpose</legend>
              @for (purpose of purposes; track purpose) {
                <label
                  ><input
                    type="checkbox"
                    [checked]="state.filters().purposes.includes(purpose)"
                    (change)="toggle('purposes', purpose)"
                  />{{ purpose }}</label
                >
              }
            </fieldset>
            <fieldset>
              <legend>Status</legend>
              @for (status of statuses; track status) {
                <label
                  ><input
                    type="checkbox"
                    [checked]="state.filters().statuses.includes(status)"
                    (change)="toggle('statuses', status)"
                  />{{ status }}</label
                >
              }
            </fieldset>
            <label
              ><input
                type="checkbox"
                [checked]="state.filters().unclassified"
                (change)="diagnostic('unclassified', $any($event.target).checked)"
              />Unclassified / invalid</label
            >
            <label
              ><input
                type="checkbox"
                [checked]="state.filters().issues"
                (change)="diagnostic('issues', $any($event.target).checked)"
              />Classification issues</label
            >
          </div>
        </details>
      </form>
      <div class="criteria" aria-label="Active library criteria">
        @for (field of fields; track field) {
          @for (value of state.filters()[field]; track value) {
            <button
              (click)="toggle(field, value)"
              [attr.aria-label]="'Remove ' + field + ': ' + value"
            >
              {{ field }}: {{ value }} ×
            </button>
          }
        }
        @if (state.filters().unclassified) {
          <button (click)="state.setFilters({ unclassified: false })">Remove unclassified ×</button>
        }
        @if (state.filters().issues) {
          <button (click)="state.setFilters({ issues: false })">Remove issues ×</button>
        }
      </div>
    </fieldset>
  `,
  styles: `
    :host {
      display: block;
      flex: 1;
      min-width: 0;
    }
    .controls {
      display: block;
      border: 0;
      margin: 0;
      padding: 0;
      min-width: 0;
    }
    nav,
    form,
    .criteria {
      display: flex;
      gap: 0.3rem;
      align-items: center;
      flex-wrap: wrap;
    }
    nav button {
      text-transform: capitalize;
    }
    label {
      font-size: 0.75rem;
    }
    form > label {
      flex: 1;
    }
    input[type='search'] {
      width: 100%;
      padding: 0.4rem;
    }
    details {
      position: relative;
    }
    summary {
      cursor: pointer;
    }
    .options {
      position: absolute;
      right: 0;
      top: 100%;
      z-index: 5;
      background: #243b2e;
      border: 1px solid #8c967f;
      padding: 1rem;
      width: 300px;
      box-shadow: 0 4px 12px #0008;
    }
    .options > label {
      display: block;
      margin: 0.5rem 0;
    }
    fieldset {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .criteria button {
      font: inherit;
      font-size: 0.65rem;
      padding: 0.2rem 0.4rem;
      background: #324d3b;
      border: 1px solid #8c967f;
      color: inherit;
      border-radius: 1rem;
    }
    .criteria {
      margin-top: 0.3rem;
    }
  `,
})
export class LibraryFiltersControl implements OnDestroy {
  readonly state = inject(LibraryState);
  readonly ready = input(true);
  private tagEdit = '';
  get tagText() {
    const parsed = [
      ...new Set(
        this.tagEdit
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    return JSON.stringify(parsed) === JSON.stringify(this.state.filters().tags)
      ? this.tagEdit
      : this.state.filters().tags.join(', ');
  }
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
  readonly purposes = ['session', 'guidance', 'tooling'];
  readonly statuses = ['current', 'draft', 'superseded'];
  readonly fields = ['types', 'tags', 'purposes', 'statuses'] as const;
  private readonly options = viewChild<ElementRef<HTMLDetailsElement>>('options');
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
  searchAll() {
    clearTimeout(this.timer);
    const options = this.options();
    if (options) options.nativeElement.open = false;
    void this.state.searchAll();
  }
  toggle(field: 'types' | 'tags' | 'purposes' | 'statuses', value: string) {
    const values = this.state.filters()[field];
    void this.state.setFilters({
      [field]: values.includes(value) ? values.filter((v) => v !== value) : [...values, value],
    });
  }
  tags(text: string) {
    this.tagEdit = text;
    void this.state.setFilters({
      tags: [
        ...new Set(
          text
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        ),
      ],
    });
  }
  diagnostic(field: 'unclassified' | 'issues', checked: boolean) {
    const change: Partial<LibraryFilters> = { [field]: checked };
    // Explicit diagnostic access must include legacy/invalid declarations without trusted purpose/status.
    if (checked) {
      change.purposes = [];
      change.statuses = [];
    }
    void this.state.setFilters(change);
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
}
