import { PreparedArtwork } from '../preparation/artwork-sources';
import {
  Component,
  inject,
  computed,
  input,
  output,
  signal,
  afterRenderEffect,
  viewChild,
  ElementRef,
} from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatMenuModule } from '@angular/material/menu';
import { PreparedItemData } from '../../api/generated';
import { PlayingCard } from '../shared/playing-card/playing-card';

@Component({
  selector: 'read-card-table',
  imports: [PlayingCard, DragDropModule, MatMenuModule],
  template: `
    <section aria-label="Session card table" cdkDropListGroup>
      <div class="table-row">
        <div
          class="shelf"
          #shelf
          cdkDropList
          #activeList="cdkDropList"
          cdkDropListOrientation="horizontal"
          [cdkDropListData]="'active'"
          [cdkDropListDisabled]="disabled() || filtered()"
          (cdkDropListDropped)="dropActive($event)"
          aria-label="Active cards"
          role="list"
          tabindex="0"
        >
          @for (item of active(); track item.id) {
            <div
              class="entry"
              role="listitem"
              cdkDrag
              [cdkDragData]="item.id"
              [cdkDragStartDelay]="{ touch: 180, mouse: 0 }"
              [cdkDragDisabled]="disabled() || filtered()"
              (cdkDragStarted)="dragging.set(true)"
              (cdkDragEnded)="endDrag()"
              [class.selected]="selected() === item.id"
              [attr.data-item-id]="item.id"
            >
              <playing-card
                [artwork]="artwork.item(campaign(), session(), item)"
                [title]="title(item)"
                [type]="metadata(item)?.type ?? ''"
                [summary]="metadata(item)?.summary ?? ''"
                [tags]="metadata(item)?.tags ?? []"
                [selectable]="true"
                [selectionLabel]="item.title"
                [selected]="selected() === item.id"
                [disabled]="disabled()"
                (select)="choose(item.id)"
                (openDocument)="choose(item.id)"
              >
                <button
                  cardActions
                  type="button"
                  class="card-menu"
                  [matMenuTriggerFor]="actions"
                  [disabled]="disabled()"
                  [attr.aria-label]="'Card actions: ' + item.title"
                  (pointerdown)="$event.stopPropagation()"
                  (mousedown)="$event.stopPropagation()"
                  (touchstart)="$event.stopPropagation()"
                >
                  ⋯
                </button>
              </playing-card>
              <mat-menu #actions="matMenu">
                <button
                  mat-menu-item
                  [disabled]="filtered() || position(item.id) === 0"
                  (click)="moveItem.emit({ id: item.id, to: position(item.id) - 1 })"
                >
                  Move left
                </button>
                <button
                  mat-menu-item
                  [disabled]="
                    filtered() || position(item.id) === (table()?.active?.length ?? 0) - 1
                  "
                  (click)="moveItem.emit({ id: item.id, to: position(item.id) + 1 })"
                >
                  Move right
                </button>
                <button mat-menu-item (click)="useItem.emit(item.id)">Mark used</button>
              </mat-menu>
            </div>
          } @empty {
            <p class="empty" role="status">
              {{
                filtered()
                  ? 'No matching active cards.'
                  : 'No active cards. Add material in Prepare or return a used card to the table.'
              }}
            </p>
          }
        </div>
        <div
          class="used-pile"
          cdkDropList
          [cdkDropListData]="'pile'"
          [cdkDropListSortingDisabled]="true"
          [cdkDropListDisabled]="disabled() || filtered()"
          (cdkDropListDropped)="dropUsed($event)"
          aria-label="Used cards drop target"
        >
          <button
            type="button"
            [attr.aria-expanded]="usedOpen()"
            [disabled]="disabled()"
            (click)="usedOpen.set(!usedOpen())"
            aria-controls="used-card-tray"
            [attr.aria-label]="'Used cards (' + (table()?.used?.length ?? 0) + ')'"
          >
            <span class="pile-art" aria-hidden="true">▱</span>
            <strong>Used cards</strong
            ><span>{{ used().length }} / {{ table()?.used?.length ?? 0 }}</span>
            <small>Drop cards here</small>
          </button>
        </div>
      </div>
      @if (filtered()) {
        <p class="hint">Clear the find and group filter to drag or rearrange cards.</p>
      }
      @if (usedOpen()) {
        <aside class="used-tray" id="used-card-tray" aria-label="Used cards tray">
          <header>
            <strong>Used cards</strong
            ><button type="button" (click)="usedOpen.set(false)" aria-label="Close used cards">
              ×
            </button>
          </header>
          <div
            class="used-shelf"
            cdkDropList
            [cdkDropListData]="'used'"
            [cdkDropListSortingDisabled]="true"
            [cdkDropListDisabled]="disabled() || filtered()"
            (cdkDropListDropped)="dropUsed($event)"
            role="list"
          >
            @for (item of used(); track item.id) {
              <div
                class="entry"
                role="listitem"
                cdkDrag
                [cdkDragData]="item.id"
                [cdkDragStartDelay]="{ touch: 180, mouse: 0 }"
                [cdkDragDisabled]="disabled() || filtered()"
                (cdkDragStarted)="dragging.set(true)"
                (cdkDragEnded)="endDrag()"
                [class.selected]="selected() === item.id"
                [attr.data-item-id]="item.id"
              >
                <playing-card
                  [artwork]="artwork.item(campaign(), session(), item)"
                  [title]="title(item)"
                  [type]="metadata(item)?.type ?? ''"
                  [summary]="metadata(item)?.summary ?? ''"
                  [tags]="metadata(item)?.tags ?? []"
                  [selectable]="true"
                  [selectionLabel]="item.title"
                  [selected]="selected() === item.id"
                  [disabled]="disabled()"
                  (select)="choose(item.id)"
                  (openDocument)="choose(item.id)"
                >
                  <button
                    cardActions
                    type="button"
                    class="card-menu"
                    [matMenuTriggerFor]="usedActions"
                    [disabled]="disabled()"
                    [attr.aria-label]="'Card actions: ' + item.title"
                    (pointerdown)="$event.stopPropagation()"
                    (mousedown)="$event.stopPropagation()"
                    (touchstart)="$event.stopPropagation()"
                  >
                    ⋯
                  </button>
                </playing-card>
                <mat-menu #usedActions="matMenu"
                  ><button mat-menu-item (click)="restoreItem.emit(item.id)">
                    Return to table
                  </button></mat-menu
                >
              </div>
            } @empty {
              <p role="status">
                {{ filtered() ? 'No matching used cards.' : 'No used cards.' }}
              </p>
            }
          </div>
        </aside>
      }
    </section>
  `,
  styleUrl: './card-table.css',
})
export class CardTable {
  readonly artwork = inject(PreparedArtwork);
  readonly campaign = input('');
  readonly session = input('');
  readonly items = input<PreparedItemData[]>([]);
  readonly table = input<{ active: string[]; used: string[] } | null>(null);
  readonly selected = input<string | null>(null);
  readonly disabled = input(false);
  readonly query = input('');
  readonly group = input('');
  readonly filtered = computed(() => !!this.query().trim() || !!this.group());
  readonly selectItem = output<string>();
  readonly moveItem = output<{ id: string; to: number }>();
  readonly useItem = output<string>();
  readonly restoreItem = output<string>();
  readonly usedOpen = signal(false);
  readonly dragging = signal(false);
  private dragEndedAt = 0;
  readonly active = computed(() => this.entries(this.table()?.active ?? []));
  readonly used = computed(() => this.entries(this.table()?.used ?? []));
  private entries(ids: string[]) {
    const byId = new Map(this.items().map((item) => [item.id, item]));
    const query = this.query().trim().toLowerCase();
    return ids.flatMap((id) => {
      const item = byId.get(id);
      return item &&
        (!this.group() || item.capturedSource?.classification?.metadata?.type === this.group()) &&
        `${item.title} ${item.provenance.path}`.toLowerCase().includes(query)
        ? [item]
        : [];
    });
  }
  metadata(item: PreparedItemData) {
    return item.capturedSource?.classification?.metadata;
  }
  title(item: PreparedItemData) {
    return this.metadata(item)?.title ?? item.title;
  }
  position(id: string) {
    return this.table()?.active.indexOf(id) ?? -1;
  }
  choose(id: string) {
    if (!this.disabled() && !this.dragging() && Date.now() - this.dragEndedAt > 200)
      this.selectItem.emit(id);
  }
  endDrag() {
    this.dragEndedAt = Date.now();
    this.dragging.set(false);
  }
  private readonly shelf = viewChild<ElementRef<HTMLElement>>('shelf');
  constructor() {
    afterRenderEffect(() => {
      const id = this.selected();
      this.active();
      if (this.dragging()) return;
      const shelf = this.shelf()?.nativeElement;
      const entry = Array.from(shelf?.querySelectorAll<HTMLElement>('.entry') ?? []).find(
        (node) => node.dataset['itemId'] === id,
      );
      if (!shelf || !entry) return;
      const box = entry.getBoundingClientRect(),
        frame = shelf.getBoundingClientRect();
      if (box.left < frame.left) shelf.scrollLeft += box.left - frame.left;
      else if (box.right > frame.right) shelf.scrollLeft += box.right - frame.right;
    });
  }
  dropActive(event: CdkDragDrop<string>) {
    if (this.disabled() || this.filtered()) return;
    const id = event.item.data as string;
    if (event.previousContainer === event.container)
      this.moveItem.emit({ id, to: event.currentIndex });
    else this.restoreItem.emit(id);
  }
  dropUsed(event: CdkDragDrop<string>) {
    if (!this.disabled() && !this.filtered()) this.useItem.emit(event.item.data as string);
  }
}
