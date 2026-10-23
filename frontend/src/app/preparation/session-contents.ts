import { ArtworkImage } from '../shared/artwork/artwork-image';
import { PreparedArtwork } from '../preparation/artwork-sources';
import {
  Component,
  inject,
  ElementRef,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { PreparedItemData } from '../../api/generated';

@Component({
  selector: 'session-contents',
  imports: [ArtworkImage, FormsModule, MatButtonModule],
  templateUrl: './session-contents.html',
  styleUrl: './session-contents.css',
})
export class SessionContents {
  readonly artwork = inject(PreparedArtwork);
  readonly campaign = input('');
  readonly session = input('');
  readonly items = input<PreparedItemData[]>([]);
  readonly selected = input<string | null>(null);
  readonly reading = input(false);
  readonly expanded = input(true);
  readonly disabled = input(false);
  readonly sessionId = input<string | null>(null);
  readonly selectItem = output<string>();
  readonly moveItem = output<{ id: string; delta: number }>();
  readonly removeItem = output<string>();
  readonly addSource = output<void>();
  readonly addLibrary = output<void>();
  readonly group = signal('');
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
  readonly sessionNotes = output<void>();
  readonly query = signal('');
  readonly visible = computed(() =>
    this.items()
      .map((item, index) => ({ item, number: index + 1 }))
      .filter(
        ({ item }) =>
          !this.group() || item.capturedSource?.classification?.metadata?.type === this.group(),
      )
      .filter(({ item }) =>
        [item.title, this.context(item)]
          .join(' ')
          .toLowerCase()
          .includes(this.query().trim().toLowerCase()),
      ),
  );
  @ViewChild('list') private list?: ElementRef<HTMLElement>;
  constructor() {
    effect(() => {
      this.sessionId();
      this.query.set('');
      this.group.set('');
    });
    effect(() => {
      this.selected();
      this.visible();
      this.reading();
      this.expanded();
      setTimeout(() => this.revealSelected());
    });
  }
  context(item: PreparedItemData) {
    const origin = item.provenance.authored;
    if (origin)
      return `${item.capturedSource?.classification?.metadata?.type ?? 'Card'} · Draft revision ${origin.revision}`;
    return item.provenance.section
      ? (item.capturedSource?.classification?.metadata?.title ?? item.provenance.path)
      : (item.capturedSource?.classification?.metadata?.type ?? 'Document');
  }
  revealSelected() {
    const list = this.list?.nativeElement;
    const selected = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !selected || !this.expanded()) return;
    // Scroll only this list, without disturbing the source reader or document.
    const top =
      selected.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    const bottom = top + selected.getBoundingClientRect().height;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }
}
