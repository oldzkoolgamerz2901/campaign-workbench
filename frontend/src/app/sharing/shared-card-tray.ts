import { CdkScrollable } from '@angular/cdk/scrolling';
import { CdkDropList } from '@angular/cdk/drag-drop';
import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
  OnDestroy,
  untracked,
} from '@angular/core';
import {
  SharingGestures,
  SharingDragSource,
  SharingDropTarget,
  SharingDrag,
  SharingDrop,
  SharingDestination,
} from './sharing-gestures';
import { inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { ArtworkSource } from '../shared/artwork/artwork-image';
import type { SharedCardData } from '../../api/generated/model/sharedCardData';
import type { SharedPile, OrganizeCollection } from '../../api/generated';

@Component({
  selector: 'shared-card-tray',
  imports: [
    CdkScrollable,
    CdkDropList,
    PlayingCard,
    NgTemplateOutlet,
    FormsModule,
    SharingDragSource,
    SharingDropTarget,
  ],
  template: ` <div #tray tabindex="-1" aria-label="Shared cards">
      <div class="heading">
        <h3>Piles</h3>
        @if (organizer()) {
          <button type="button" [disabled]="disabled()" (click)="edit('CREATE')">New pile</button>
        }
      </div>
      <div class="piles">
        @for (pile of piles(); track pile.id; let i = $index) {
          <section
            class="pile"
            [attr.aria-label]="pile.name"
            [sharingTarget]="{ kind: 'location', collection: collection(), pile: pile.id }"
            [accepts]="acceptLocation"
            (dropped)="drop($event)"
          >
            <div class="heading">
              <h4>{{ pile.name }}{{ arrivals()[pile.id] ? ' · New' : '' }}</h4>
              <span
                >{{ members(pile.id).length }}
                {{ members(pile.id).length === 1 ? 'card' : 'cards' }}</span
              >
            </div>
            @if (cover(pile); as card) {
              <div [class.stacked]="members(pile.id).length > 1">
                <ng-container *ngTemplateOutlet="surface; context: { $implicit: card }" />
              </div>
              <div class="arrows">
                <button
                  type="button"
                  [attr.aria-label]="'Previous cover in ' + pile.name"
                  [disabled]="members(pile.id).length < 2 || (organizer() && disabled())"
                  (click)="cycle(pile, -1)"
                >
                  ‹
                </button>
                <button type="button" (click)="show(pile.id)">Show all</button>
                <button
                  type="button"
                  [attr.aria-label]="'Next cover in ' + pile.name"
                  [disabled]="members(pile.id).length < 2 || (organizer() && disabled())"
                  (click)="cycle(pile, 1)"
                >
                  ›
                </button>
              </div>
            } @else {
              <p>Empty pile</p>
              <button type="button" (click)="show(pile.id)">Show all</button>
            }
            @if (organizer()) {
              <details>
                <summary [attr.aria-label]="'Actions for pile ' + pile.name">Pile actions</summary>
                <button type="button" [disabled]="disabled()" (click)="edit('RENAME', pile)">
                  Rename pile
                </button>
                <button
                  type="button"
                  [disabled]="disabled() || i === 0"
                  (click)="order(pile, i - 1)"
                >
                  Move pile earlier
                </button>
                <button
                  type="button"
                  [disabled]="disabled() || i === piles().length - 1"
                  (click)="order(pile, i + 1)"
                >
                  Move pile later
                </button>
                <button type="button" [disabled]="disabled()" (click)="removePile(pile)">
                  Delete pile
                </button>
              </details>
            }
          </section>
        } @empty {
          <p>No named piles.</p>
        }
      </div>
      @if (!shownPile()) {
        <ng-container *ngTemplateOutlet="targets" />
      }
      <h3>Unsorted</h3>
      <div
        class="tray"
        cdkScrollable
        [sharingTarget]="{ kind: 'location', collection: collection(), pile: null }"
        [accepts]="acceptLocation"
        (dropped)="drop($event)"
      >
        @for (card of members(null); track card.id) {
          <div
            class="entry"
            [sharingTarget]="{
              kind: 'location',
              collection: collection(),
              pile: card.pile || null,
              before: card.id,
            }"
            [accepts]="acceptOrder(card)"
            (dropped)="drop($event)"
          >
            <ng-container *ngTemplateOutlet="surface; context: { $implicit: card }" />
          </div>
        } @empty {
          <p>No shared cards in Unsorted.</p>
        }
      </div>
    </div>
    <dialog #all cdkScrollable aria-label="Show all cards" (close)="allClosed()">
      <div class="heading">
        <h3>{{ shownPile()?.name }}</h3>
        <button type="button" (click)="all.close()">Close pile</button>
      </div>
      @if (shownPile()) {
        <ng-container *ngTemplateOutlet="targets" />
        <div class="grid">
          @for (card of members(shown()); track card.id) {
            <div
              class="entry"
              [sharingTarget]="{
                kind: 'location',
                collection: collection(),
                pile: card.pile || null,
                before: card.id,
              }"
              [accepts]="acceptOrder(card)"
              (dropped)="drop($event)"
            >
              <ng-container *ngTemplateOutlet="surface; context: { $implicit: card }" />
            </div>
          } @empty {
            <p>Empty pile</p>
          }
        </div>
      }
    </dialog>
    <dialog #expanded aria-label="Expanded card" (close)="closed()" (click)="close()">
      @if (current(); as card) {
        <playing-card
          [title]="card.visible.title"
          [type]="card.visible.type"
          [summary]="card.visible.summary"
          [tags]="card.visible.tags"
          [backText]="card.visible.backText"
          [context]="card.id"
          [artwork]="artwork()(card)"
          [documentAvailable]="false"
        />
        <ng-container *ngTemplateOutlet="menu; context: { $implicit: card }" />
      }
      <button type="button" (click)="close()">Close expanded card</button>
    </dialog>
    <dialog #editor aria-label="Organize collection" (close)="editorClosed()">
      <h3>
        {{
          editing() === 'CREATE'
            ? 'New pile'
            : editing() === 'RENAME'
              ? 'Rename pile'
              : editing() === 'DELETE'
                ? 'Delete pile'
                : 'Move card'
        }}
      </h3>
      @if (editing() === 'CREATE' || editing() === 'RENAME') {
        <label>Pile name <input aria-label="Pile name" maxlength="200" [(ngModel)]="name" /></label>
      }
      @if (editing() === 'DELETE') {
        <p>Delete {{ editPile()?.name }}? Its cards return to Unsorted.</p>
      }
      @if (editing() === 'MOVE') {
        <label
          >Destination
          <select
            aria-label="Move destination"
            [(ngModel)]="destination"
            (ngModelChange)="before = ''"
          >
            <option value="">Unsorted</option>
            @for (pile of piles(); track pile.id) {
              <option [value]="pile.id">{{ pile.name }}</option>
            }
          </select></label
        >
        <label
          >Position
          <select aria-label="Move before" [(ngModel)]="before">
            <option value="">At end</option>
            @for (card of members(destination || null); track card.id) {
              @if (card.id !== editCard()?.id) {
                <option [value]="card.id">Before {{ card.visible.title }}</option>
              }
            }
          </select></label
        >
      }
      <button
        type="button"
        [disabled]="
          disabled() || ((editing() === 'CREATE' || editing() === 'RENAME') && !name.trim())
        "
        (click)="save()"
      >
        {{ editing() === 'DELETE' ? 'Confirm pile deletion' : 'Save organization' }}
      </button>
      <button type="button" (click)="editor.close()">Cancel</button>
    </dialog>
    <ng-template #targets>
      @if (gestures.active(); as source) {
        <div class="drop-destinations" aria-label="Card destinations">
          @if (organizer()) {
            @for (location of locations(); track location.id) {
              <div
                class="drop-target"
                [sharingTarget]="{ kind: 'location', collection: collection(), pile: location.id }"
                [accepts]="acceptLocation"
                (dropped)="drop($event)"
              >
                {{ source.kind === 'source' ? 'Share to' : 'Move to' }} {{ location.name }}
              </div>
            }
          }
          @for (destination of destinations(); track destination.id + (destination.pile || '')) {
            @if (acceptCollection(destination.id)(source)) {
              <div
                class="drop-target"
                [sharingTarget]="{
                  kind: 'collection',
                  collection: destination.id,
                  pile: destination.pile,
                }"
                [accepts]="acceptCollection(destination.id)"
                (dropped)="drop($event)"
              >
                {{ destination.name }}
              </div>
            }
          }
          @if (
            shownPile() && claimable() && source.kind === 'card' && source.mode === 'INVENTORY'
          ) {
            <div
              class="drop-target"
              [sharingTarget]="{ kind: 'claim' }"
              [accepts]="acceptClaim"
              (dropped)="drop($event)"
            >
              My Cards · Claim
            </div>
          }
          @if (
            source.kind === 'card' &&
            source.collection === collection() &&
            actionsFor(source.id).length
          ) {
            <div
              class="drop-target"
              [sharingTarget]="{ kind: 'remove' }"
              [accepts]="acceptRemove"
              (dropped)="drop($event)"
            >
              {{ actionsFor(source.id)[0] }} · confirm
            </div>
          }
        </div>
      }
    </ng-template>
    <ng-template #surface let-card>
      <div cdkDropList [cdkDropListSortingDisabled]="true">
        <div
          [sharingDrag]="dragSource(card)"
          [dragDisabled]="disabled() || (!organizer() && !actions()(card).length)"
          [attr.data-shared-card]="card.id"
        >
          <playing-card
            [title]="card.visible.title"
            [type]="card.visible.type"
            [summary]="card.visible.summary"
            [tags]="card.visible.tags"
            [backText]="card.visible.backText"
            [context]="card.id"
            [artwork]="artwork()(card)"
            [documentAvailable]="false"
            [selectable]="true"
            [selectionLabel]="'Expand ' + card.visible.title"
            (select)="open(card.id)"
          />
        </div>
      </div>
      <ng-container *ngTemplateOutlet="menu; context: { $implicit: card }" />
      <small>{{ card.mode === 'HANDOUT' ? 'Handout' : 'Inventory' }}</small>
    </ng-template>
    <ng-template #menu let-card>
      @if (actions()(card).length || organizer()) {
        <details (click)="$event.stopPropagation()">
          <summary [attr.aria-label]="'Actions for ' + card.visible.title">Card actions</summary>
          @if (organizer()) {
            <button type="button" [disabled]="disabled()" (click)="moveCard(card)">
              Move / reorder
            </button>
          }
          @for (action of actions()(card); track action) {
            <button type="button" [disabled]="disabled()" (click)="invoke(card, action)">
              {{ action }}
            </button>
          }
        </details>
      }
    </ng-template>`,
  styles: `
    .heading,
    .arrows {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    h3,
    h4 {
      overflow-wrap: anywhere;
    }
    h4 {
      margin: 0.5rem 0;
    }
    .tray {
      display: flex;
      gap: 1rem;
      overflow: auto;
      padding: 1rem 0;
      align-items: start;
    }
    .piles,
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(243px, 100%), 243px));
      gap: 1.4rem;
      align-items: start;
    }
    .pile {
      min-width: 0;
      padding: 0.5rem;
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    .piles {
      grid-template-columns: repeat(auto-fit, minmax(min(263px, 100%), 263px));
    }
    .entry {
      flex: 0 0 243px;
      width: 243px;
      max-width: 100%;
    }
    .stacked {
      box-shadow:
        3px 3px 0 var(--line),
        6px 6px 0 var(--panel);
      margin: 0 6px 6px 0;
    }
    small {
      display: block;
      margin-top: 0.4rem;
      color: var(--muted);
    }
    dialog {
      box-sizing: border-box;
      width: min(440px, calc(100vw - 2rem));
      max-height: 90dvh;
      overflow: auto;
      padding: 1rem;
      background: var(--panel);
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    dialog[aria-label='Show all cards'] {
      width: min(1100px, calc(100vw - 2rem));
    }
    dialog::backdrop {
      background: #000b;
    }
    button,
    summary,
    select,
    input {
      min-height: 44px;
    }
    button {
      background: transparent;
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0.3rem 0.6rem;
      margin-top: 0.4rem;
    }
    label {
      display: block;
      margin: 0.8rem 0;
    }
    input,
    select {
      max-width: 100%;
      box-sizing: border-box;
    }
    @media (max-width: 450px) {
      .entry {
        flex-basis: 220px;
        width: 220px;
      }
    }
  `,
})
export class SharedCardTray implements OnDestroy {
  readonly gestures = inject(SharingGestures);
  readonly collection = input('group');
  readonly claimable = input(false);
  readonly destinations = input<SharingDestination[]>([]);
  readonly externalDrop = output<SharingDrop>();
  readonly locations = computed(() => [
    { id: null as string | null, name: 'Unsorted' },
    ...this.piles().map((p) => ({ id: p.id, name: p.name })),
  ]);
  dragSource(card: SharedCardData): SharingDrag {
    return {
      kind: 'card',
      id: card.id,
      collection: this.collection(),
      pile: card.pile || null,
      mode: card.mode,
    };
  }
  readonly acceptLocation = (source: SharingDrag) =>
    !this.disabled() &&
    (source.kind === 'source'
      ? this.collection() === 'group'
      : this.organizer() && source.collection === this.collection());
  acceptOrder(card: SharedCardData) {
    return (source: SharingDrag) =>
      source.kind === 'card' && source.id !== card.id && this.acceptLocation(source);
  }
  acceptCollection(id: string) {
    return (source: SharingDrag) =>
      !this.disabled() &&
      (source.kind === 'source' || (source.mode === 'INVENTORY' && source.collection !== id));
  }
  readonly acceptClaim = (source: SharingDrag) =>
    !this.disabled() &&
    this.claimable() &&
    source.kind === 'card' &&
    source.collection === 'group' &&
    source.mode === 'INVENTORY';
  actionsFor(id: string) {
    const card = this.cards().find((c) => c.id === id);
    return (card ? this.actions()(card) : []).filter((a) => a === 'Remove' || a === 'Withdraw');
  }
  readonly acceptRemove = (source: SharingDrag) =>
    !this.disabled() &&
    source.kind === 'card' &&
    source.collection === this.collection() &&
    this.cards().some((c) => c.id === source.id) &&
    this.actionsFor(source.id).length > 0;
  drop(event: SharingDrop) {
    const { source, target } = event;
    if (this.disabled()) return;
    if (target.kind === 'location' && source.kind === 'card' && this.acceptLocation(source)) {
      this.emit({
        kind: 'MOVE',
        card: source.id,
        source: source.pile || undefined,
        pile: target.pile || undefined,
        before: target.before,
      });
    } else if (target.kind === 'remove' || target.kind === 'claim') {
      const card = this.cards().find((c) => c.id === source.id);
      if (card) this.invoke(card, target.kind === 'claim' ? 'Claim' : this.actionsFor(card.id)[0]);
    } else this.externalDrop.emit(event);
  }

  readonly cards = input.required<SharedCardData[]>();
  readonly piles = input<SharedPile[]>([]);
  readonly organizer = input(false);
  readonly artwork = input.required<(card: SharedCardData) => ArtworkSource | null>();
  readonly identity = input('');
  readonly actions = input<(card: SharedCardData) => string[]>(() => []);
  readonly disabled = input(false);
  readonly command = output<{ card: SharedCardData; action: string }>();
  readonly organize = output<OrganizeCollection>();
  private readonly selected = signal('');
  private readonly commandCard = signal('');
  readonly current = computed(() => this.cards().find((card) => card.id === this.selected()));
  readonly shown = signal<string | null>(null);
  readonly shownPile = computed(() => this.piles().find((p) => p.id === this.shown()));
  readonly arrivals = signal<Record<string, boolean>>({});
  private previousCards: SharedCardData[] | null = null;
  private previousIdentity = '';
  private readonly browsed = signal<Record<string, string>>({});
  readonly editing = signal('');
  readonly editPile = signal<SharedPile | null>(null);
  readonly editCard = signal<SharedCardData | null>(null);
  name = '';
  destination = '';
  before = '';
  private readonly expanded = viewChild<ElementRef<HTMLDialogElement>>('expanded');
  private readonly all = viewChild<ElementRef<HTMLDialogElement>>('all');
  private readonly editor = viewChild<ElementRef<HTMLDialogElement>>('editor');
  private readonly tray = viewChild<ElementRef<HTMLElement>>('tray');
  private target: HTMLElement | null = null;
  private allTarget: HTMLElement | null = null;
  private editorTarget: HTMLElement | null = null;
  private previousOverflow: string | null = null;
  constructor() {
    effect(() => {
      this.identity();
      this.gestures.cancel();
      this.commandCard.set('');
      this.close();
      this.all()?.nativeElement.close();
      this.editor()?.nativeElement.close();
      this.browsed.set({});
    });
    effect(() => {
      const cards = this.cards(),
        identity = this.identity(),
        ps = this.piles();
      untracked(() => {
        if (this.previousIdentity !== identity || this.previousCards === null) {
          this.previousIdentity = identity;
          this.previousCards = cards;
          this.arrivals.set({});
          this.browsed.set(
            Object.fromEntries(
              ps.map((pile) => [
                pile.id,
                pile.cover || cards.find((c) => c.pile === pile.id)?.id || '',
              ]),
            ),
          );
          return;
        }
        const previous = this.previousCards;
        const local = { ...this.browsed() },
          arrivals = { ...this.arrivals() };
        for (const pile of ps) {
          const members = cards.filter((c) => c.pile === pile.id),
            old = previous.filter((c) => c.pile === pile.id);
          if (!local[pile.id]) local[pile.id] = pile.cover || members[0]?.id || '';
          if (local[pile.id] && !members.some((c) => c.id === local[pile.id])) {
            const index = old.findIndex((c) => c.id === local[pile.id]);
            const next = [...old.slice(index + 1), ...old.slice(0, index)].find((c) =>
              members.some((m) => m.id === c.id),
            );
            local[pile.id] = next?.id || pile.cover || '';
          }
          if (this.shown() !== pile.id && members.some((c) => !previous.some((p) => p.id === c.id)))
            arrivals[pile.id] = true;
        }
        this.browsed.set(local);
        this.arrivals.set(arrivals);
        this.previousCards = cards;
      });
    });
    effect(() => {
      if (!this.current()) this.close();
    });
    effect(() => {
      if (this.shown() && !this.shownPile()) this.all()?.nativeElement.close();
    });
    effect(() => {
      const id = this.commandCard();
      if (id && !this.cards().some((c) => c.id === id)) {
        this.commandCard.set('');
        queueMicrotask(() => this.focusFallback());
      }
    });
  }
  members(pile: string | null) {
    return this.cards().filter((c) => (c.pile || null) === pile);
  }
  cover(pile: SharedPile) {
    const cards = this.members(pile.id),
      local = this.browsed()[pile.id];
    return (
      cards.find((c) => c.id === (this.organizer() ? pile.cover : local || pile.cover)) ||
      cards.find((c) => c.id === pile.cover) ||
      cards[0]
    );
  }
  cycle(pile: SharedPile, delta: number) {
    const cards = this.members(pile.id),
      current = this.cover(pile);
    if (!current || !cards.length) return;
    const card = cards[(cards.indexOf(current) + delta + cards.length) % cards.length];
    if (this.organizer()) this.emit({ kind: 'COVER', pile: pile.id, card: card.id });
    else this.browsed.update((value) => ({ ...value, [pile.id]: card.id }));
  }
  order(pile: SharedPile, index: number) {
    const remaining = this.piles().filter((p) => p.id !== pile.id);
    this.emit({ kind: 'ORDER', pile: pile.id, before: remaining[index]?.id || undefined });
  }
  edit(kind: string, pile: SharedPile | null = null) {
    this.editorTarget = this.active();
    this.editing.set(kind);
    this.editPile.set(pile);
    this.name = pile?.name || '';
    this.editor()?.nativeElement.showModal();
  }
  removePile(pile: SharedPile) {
    if (this.members(pile.id).length) this.edit('DELETE', pile);
    else this.emit({ kind: 'DELETE', pile: pile.id });
  }
  moveCard(card: SharedCardData) {
    this.editCard.set(card);
    this.destination = card.pile || '';
    this.before = '';
    this.edit('MOVE');
  }
  save() {
    const kind = this.editing();
    this.emit(
      kind === 'MOVE'
        ? {
            kind,
            card: this.editCard()!.id,
            source: this.editCard()!.pile,
            pile: this.destination || undefined,
            before: this.before || undefined,
          }
        : { kind, pile: this.editPile()?.id, name: this.name, confirmed: kind === 'DELETE' },
    );
    this.editor()?.nativeElement.close();
  }
  private emit(request: OrganizeCollection) {
    if (this.organizer() && !this.disabled()) this.organize.emit(request);
  }
  rememberCommand(id: string) {
    this.commandCard.set(id);
  }
  invoke(card: SharedCardData, action: string) {
    this.rememberCommand(card.id);
    this.command.emit({ card, action });
  }
  show(id: string) {
    this.allTarget = this.active();
    this.shown.set(id);
    this.arrivals.update((value) => ({ ...value, [id]: false }));
    this.lock();
    this.all()?.nativeElement.showModal();
  }
  allClosed() {
    this.gestures.cancel();
    this.shown.set(null);
    if (!this.expanded()?.nativeElement.open) this.restoreScroll();
    if (!this.expanded()?.nativeElement.open) this.returnFocus(this.allTarget);
  }
  open(id: string) {
    this.target = this.active();
    this.selected.set(id);
    this.lock();
    this.expanded()?.nativeElement.showModal();
  }
  close() {
    this.expanded()?.nativeElement.close();
  }
  closed() {
    this.selected.set('');
    if (!this.all()?.nativeElement.open) this.restoreScroll();
    this.returnFocus(this.target);
  }
  editorClosed() {
    this.returnFocus(this.editorTarget);
  }
  private active() {
    return document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  private focusFallback() {
    (this.all()?.nativeElement.open
      ? this.all()?.nativeElement
      : this.tray()?.nativeElement
    )?.focus({ preventScroll: true });
  }
  private returnFocus(target: HTMLElement | null) {
    if (target?.isConnected) target.focus({ preventScroll: true });
    else this.focusFallback();
  }
  private lock() {
    if (this.previousOverflow === null) this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  private restoreScroll() {
    if (this.previousOverflow !== null) {
      document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    }
  }
  ngOnDestroy() {
    this.gestures.cancel();
    this.restoreScroll();
  }
}
