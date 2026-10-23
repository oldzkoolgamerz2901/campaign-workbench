import {
  Component,
  computed,
  inject,
  input,
  output,
  afterRenderEffect,
  viewChild,
  ElementRef,
} from '@angular/core';
import { PreparedItemData, WorkspaceData } from '../../api/generated';
import { PreparedArtwork } from '../preparation/artwork-sources';
import { RelationshipSuggestions } from './relationship-suggestions';
import { PlayingCard } from '../shared/playing-card/playing-card';

/** Focus/inspection composition only. Frozen text stays in the existing workspace reader. */
@Component({
  selector: 'play-tabletop',
  imports: [PlayingCard, RelationshipSuggestions],
  templateUrl: './focused-tabletop.html',
  styleUrl: './focused-tabletop.css',
})
export class FocusedTabletop {
  readonly artwork = inject(PreparedArtwork);
  readonly campaign = input.required<string>();
  readonly session = input.required<string>();
  readonly items = input<PreparedItemData[]>([]);
  readonly workspace = input.required<WorkspaceData>();
  readonly expanded = input<string | null>(null);
  readonly inspection = input<string | null>(null);
  readonly disabled = input(false);
  readonly focusItem = output<string>();
  readonly openTarget = output<string>();
  readonly removeFocus = output<string>();
  readonly replaceFocus = output<{ slot: number; id: string }>();
  readonly activateScene = output<string | null>();
  readonly expandItem = output<string>();
  readonly returnToCards = output<void>();
  readonly openDocument = output<string>();
  readonly closeInspection = output<void>();
  readonly focused = computed(() =>
    this.workspace().focusedItemIds.flatMap((id) => this.items().filter((item) => item.id === id)),
  );
  readonly inspected = computed(
    () => this.items().find((item) => item.id === this.inspection()) ?? null,
  );
  readonly scene = computed(
    () => this.items().find((item) => item.id === this.workspace().activeSceneItemId) ?? null,
  );
  readonly inspectionHeading = viewChild<ElementRef<HTMLElement>>('inspectionHeading');
  private lastInspection: string | null = null;
  private lastExpanded: string | null = null;
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  constructor() {
    afterRenderEffect(() => {
      const id = this.inspected()?.id ?? null;
      if (id && id !== this.lastInspection) {
        const heading = this.inspectionHeading()?.nativeElement;
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView?.({ block: 'nearest' });
      }
      const returned = this.lastExpanded && !this.expanded() && !id;
      const replaced =
        this.lastInspection && !id && this.workspace().focusedItemIds.includes(this.lastInspection);
      if (returned || replaced) {
        const target = returned ? this.lastExpanded : this.lastInspection;
        const button =
          this.host.nativeElement.querySelector<HTMLButtonElement>(
            `[data-item-id="${target}"] .slot-actions button`,
          ) ??
          this.host.nativeElement.querySelector<HTMLButtonElement>(
            '.focus-slot .slot-actions button',
          );
        button?.focus({ preventScroll: true });
        button?.scrollIntoView?.({ block: 'nearest' });
      }
      this.lastInspection = id;
      this.lastExpanded = this.expanded();
    });
  }
  metadata(item: PreparedItemData) {
    return item.capturedSource?.classification?.metadata;
  }
  isScene(item: PreparedItemData) {
    return (
      this.metadata(item)?.type === 'scene' &&
      !(item.capturedSource?.classification?.issues ?? []).some(
        (issue) => issue.severity === 'error',
      )
    );
  }
  used(item: PreparedItemData) {
    return this.workspace().used.includes(item.id);
  }
}
