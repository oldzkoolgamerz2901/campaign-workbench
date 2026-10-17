import { Injectable, signal, computed } from '@angular/core';

// Disposable sample state only. Nothing here reads or writes application/campaign data.
export interface SampleItem { id: number; title: string; kind: string; path: string; description: string; }
@Injectable()
export class PrototypeState {
  readonly items = signal<SampleItem[]>([
    { id: 1, title: 'The rainbound road', kind: 'Opening scene', path: 'scenes/the-road.md', description: 'A washed-out bridge. A light in the hills.' },
    { id: 2, title: 'A visitor after dusk', kind: 'Character encounter', path: 'characters/mara-venn.md', description: 'Mara has returned with a story she cannot explain.' },
    { id: 3, title: 'The scorched letter', kind: 'Clue', path: 'clues/scorched-letter.md', description: 'An unfinished warning, sealed in black wax.' },
    { id: 4, title: 'Bells beneath the hill', kind: 'Closing scene', path: 'scenes/the-observatory.md', description: 'Something answers from the sealed lower chamber.' },
  ]);
  readonly selectedId = signal(2);
  readonly selected = computed(() => this.items().find(item => item.id === this.selectedId()) ?? this.items()[0]);
  readonly sessionTitle = signal('Ashes at the observatory');
  readonly objective = signal('Follow Mara’s warning to the old observatory. Give the party a reason to trust her before the bells begin.');
  readonly notes = signal<Record<number, string>>({ 2: '## At the table\nLet Mara speak first. She offers the broken lens before asking for help.\n\n- If pressed: she remembers a second voice.\n- Keep the letter until the party earns her trust.' });
  readonly sessionNotes = signal('Leave room for the party to investigate the bridge. The observatory can wait.');
  readonly preview = signal(false);
  readonly saveState = signal<'saved' | 'saving' | 'failed'>('saved');
  readonly failSaves = signal(false);
  readonly libraryOpen = signal(false);
  readonly query = signal('');
  readonly notice = signal('');
  readonly activeArea = signal<'session' | 'library'>('session');
  readonly sourceItems: SampleItem[] = [
    { id: 5, title: 'The Glass Observatory', kind: 'Location · whole document', path: 'places/glass-observatory.md', description: 'A ruined dome above the marsh, and the rooms beneath it.' },
    { id: 6, title: 'Mara’s missing hours', kind: 'Character · section + subsections', path: 'characters/mara-venn.md#missing-hours', description: 'A few contradictions in an otherwise ordinary journey.' },
    { id: 7, title: 'The broken lens', kind: 'Clue · section', path: 'clues/broken-lens.md', description: 'One shard is warm even in the rain.' },
  ];
  readonly filteredSources = computed(() => this.sourceItems.filter(item => (item.title + item.path + item.description).toLowerCase().includes(this.query().toLowerCase())));
  readonly note = computed(() => this.notes()[this.selectedId()] ?? '');
  private timer?: ReturnType<typeof setTimeout>;
  select(item: SampleItem) { this.selectedId.set(item.id); this.preview.set(false); }
  editNote(value: string) { this.notes.update(notes => ({ ...notes, [this.selectedId()]: value })); this.save(); }
  save() {
    clearTimeout(this.timer); this.saveState.set('saving');
    this.timer = setTimeout(() => this.saveState.set(this.failSaves() ? 'failed' : 'saved'), 650);
  }
  retry() { this.failSaves.set(false); this.save(); }
  move(id: number, offset: number) {
    const items = [...this.items()], index = items.findIndex(item => item.id === id), target = index + offset;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]]; this.items.set(items); this.save();
  }
  remove(id: number) {
    if (this.items().length <= 1) return;
    this.items.update(items => items.filter(item => item.id !== id));
    if (this.selectedId() === id) this.selectedId.set(this.items()[0].id);
    this.save();
  }
  add(item: SampleItem) {
    if (this.items().some(existing => existing.id === item.id)) { this.notice.set('Already in this sample session.'); return; }
    this.items.update(items => [...items, item]); this.selectedId.set(item.id); this.activeArea.set('session');
    this.notice.set('Added to the session. The source stays unchanged.'); this.save();
  }
  showLibrary() { this.libraryOpen.set(true); }
  exportPreview() { this.notice.set('Export includes the objective, ordered material, captured text and notes. This design study does not create a file.'); }
}
