import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  afterRenderEffect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatMenuModule } from '@angular/material/menu';
import { PreparedItemData, MoveCard, SceneMovement, PileData } from '../../api/generated';
import { PreparedArtwork } from '../preparation/artwork-sources';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { PlayWorkspaceState } from './workspace-state';

type Location = MoveCard.DestinationEnum;
type Pile = 'PILE_1' | 'PILE_2';
@Component({
  selector: 'play-tabletop',
  imports: [FormsModule, NgTemplateOutlet, PlayingCard, DragDropModule, MatMenuModule],
  templateUrl: './tabletop.html',
  styleUrl: './tabletop.css',
})
export class Tabletop {
  readonly state = inject(PlayWorkspaceState);
  readonly artwork = inject(PreparedArtwork);
  readonly campaign = input('');
  readonly session = input('');
  readonly items = input<PreparedItemData[]>([]);
  readonly selected = input<string | null>(null);
  readonly disabled = input(false);
  readonly query = input('');
  readonly group = input('');
  readonly contentsOpen = input(true);
  readonly openDocument = output<string>();
  readonly pileSlots: Pile[] = ['PILE_1', 'PILE_2'];
  readonly locations: { id: Location; title: string }[] = [
    { id: 'SESSION_CARDS', title: 'Session Cards' },
    { id: 'PILE_1', title: 'Pile 1' },
    { id: 'PILE_2', title: 'Pile 2' },
    { id: 'USED', title: 'Used' },
  ];
  readonly locked = computed(
    () =>
      this.disabled() ||
      this.state.commandBusy() ||
      this.state.status() === 'failed' ||
      this.state.overviewLoading(),
  );
  readonly filtered = computed(() => !!this.query().trim() || !!this.group());
  readonly usedOpen = signal(false);
  readonly openedPile = signal<Pile>('PILE_1');
  readonly pileName = signal('');
  readonly sceneChoice = signal('');
  readonly customize = signal(false);
  readonly choices = signal<Record<string, Location | ''>>({});
  private readonly pileDialog = viewChild<ElementRef<HTMLDialogElement>>('pileDialog');
  private readonly sceneDialog = viewChild<ElementRef<HTMLDialogElement>>('sceneDialog');
  readonly activeScene = computed(() => this.item(this.state.current()?.activeSceneItemId));
  readonly scenes = computed(() => this.items().filter((item) => this.isScene(item)));
  readonly sessionCards = computed(() =>
    this.entries(this.state.current()?.sessionCards ?? [], true),
  );
  readonly used = computed(() => this.entries(this.state.current()?.used ?? [], true));
  readonly transitionCards = computed(() => {
    const overview = this.state.overview();
    return overview
      ? this.entries([
          ...new Set([
            ...overview.workspace.pile1.items,
            ...overview.workspace.pile2.items,
            ...overview.relatedItemIds,
          ]),
        ]).filter(
          (item) => item.id !== overview.scene && item.id !== overview.workspace.activeSceneItemId,
        )
      : [];
  });
  private readonly sessionShelf = viewChild<ElementRef<HTMLElement>>('sessionShelf');
  constructor() {
    afterRenderEffect(() => {
      const selected = this.selected();
      this.sessionCards();
      const shelf = this.sessionShelf()?.nativeElement;
      const entry = Array.from(shelf?.querySelectorAll<HTMLElement>('[data-item-id]') ?? []).find(
        (node) => node.dataset['itemId'] === selected,
      );
      if (!shelf || !entry) return;
      const card = entry.getBoundingClientRect(),
        frame = shelf.getBoundingClientRect();
      if (card.left < frame.left) shelf.scrollLeft += card.left - frame.left;
      else if (card.right > frame.right) shelf.scrollLeft += card.right - frame.right;
    });
  }
  item(id: string | null | undefined) {
    return this.items().find((item) => item.id === id) ?? null;
  }
  metadata(item: PreparedItemData) {
    return item.capturedSource?.classification?.metadata;
  }
  isScene(item: PreparedItemData) {
    return (
      this.metadata(item)?.type === 'scene' &&
      !item.capturedSource?.classification?.issues?.some((issue) => issue.severity === 'error')
    );
  }
  entries(ids: string[], filter = false) {
    const query = this.query().trim().toLowerCase();
    return ids.flatMap((id) => {
      const item = this.item(id);
      return item &&
        (!filter ||
          ((!this.group() || this.metadata(item)?.type === this.group()) &&
            `${item.title} ${item.provenance.path}`.toLowerCase().includes(query)))
        ? [item]
        : [];
    });
  }
  pile(slot: Pile): PileData {
    return (
      (slot === 'PILE_1' ? this.state.current()?.pile1 : this.state.current()?.pile2) ?? {
        name: null,
        items: [],
        cover: null,
      }
    );
  }
  pileTitle(slot: Pile) {
    return this.pile(slot).name ?? (slot === 'PILE_1' ? 'Pile 1' : 'Pile 2');
  }
  location(id: string) {
    const w = this.state.current();
    return w?.activeSceneItemId === id
      ? 'Active Scene'
      : w?.pile1.items.includes(id)
        ? this.pileTitle('PILE_1')
        : w?.pile2.items.includes(id)
          ? this.pileTitle('PILE_2')
          : w?.used.includes(id)
            ? 'Used'
            : 'Session Cards';
  }
  cycle(slot: Pile, delta: number) {
    const pile = this.pile(slot),
      at = pile.items.indexOf(pile.cover ?? '');
    if (pile.items.length > 1)
      void this.state.cover(slot, pile.items[(at + delta + pile.items.length) % pile.items.length]);
  }
  move(id: string, location: Location, index?: number) {
    if (!this.locked()) void this.state.move(id, location, index);
  }
  shift(id: string, location: Location, delta: number) {
    const w = this.state.current();
    if (!w) return;
    const ids = [
      ...(location === 'PILE_1'
        ? w.pile1.items
        : location === 'PILE_2'
          ? w.pile2.items
          : location === 'USED'
            ? w.used
            : w.sessionCards),
    ];
    const at = ids.indexOf(id),
      to = at + delta;
    if (at < 0 || to < 0 || to >= ids.length || this.locked()) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    void this.state.reorder(location, ids);
  }
  drop(event: CdkDragDrop<any>, destination: Location, precise = false) {
    if (!event.isPointerOverContainer || this.locked()) return;
    if (
      this.filtered() &&
      (destination === 'SESSION_CARDS' ||
        destination === 'USED' ||
        ['SESSION_CARDS', 'USED'].includes(event.previousContainer.data))
    )
      return;
    const item = event.item.data as string;
    if (item === this.state.current()?.activeSceneItemId) return;
    this.move(item, destination, precise ? event.currentIndex : undefined);
  }
  showPile(slot: Pile) {
    this.openedPile.set(slot);
    this.pileName.set(this.pile(slot).name ?? '');
    this.pileDialog()?.nativeElement.showModal();
  }
  closePile() {
    this.pileDialog()?.nativeElement.close();
  }
  read(id: string) {
    this.closePile();
    this.openDocument.emit(id);
  }
  async showScene(id?: string) {
    this.customize.set(false);
    this.choices.set({});
    this.state.closeOverview();
    this.sceneChoice.set(
      id ?? this.state.current()?.activeSceneItemId ?? this.scenes()[0]?.id ?? '',
    );
    this.sceneDialog()?.nativeElement.showModal();
    if (this.sceneChoice()) await this.state.loadOverview(this.sceneChoice());
  }
  async chooseScene(id: string) {
    this.sceneChoice.set(id);
    this.choices.set({});
    await this.state.loadOverview(id);
  }
  closeScene() {
    this.state.closeOverview();
    this.sceneDialog()?.nativeElement.close();
  }
  choice(id: string, location: Location | '') {
    this.choices.update((values) => ({ ...values, [id]: location }));
  }
  async confirmScene(keep: boolean) {
    const overview = this.state.overview();
    if (!overview || overview.scene !== this.sceneChoice() || this.locked()) return;
    const movements: SceneMovement[] = keep
      ? []
      : Object.entries(this.choices()).flatMap(([item, destination]) =>
          destination ? [{ item, destination }] : [],
        );
    if (
      await this.state.transition({
        preparationRevision: overview.preparationRevision,
        scene: overview.scene,
        movements,
      })
    )
      this.closeScene();
  }
  async deactivate() {
    const w = this.state.current();
    if (!w || !w.activeSceneItemId || this.locked()) return;
    await this.state.loadOverview(w.activeSceneItemId);
    const overview = this.state.overview();
    if (overview)
      await this.state.transition({
        preparationRevision: overview.preparationRevision,
        scene: null,
        movements: [],
      });
  }
}
