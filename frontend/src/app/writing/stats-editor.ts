import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DraftStats, DraftStatEntry, DraftStatSection } from '../../api/generated';

/** Edits one immutable Draft field through the owner's existing save lifecycle. */
@Component({
  selector: 'stats-editor',
  imports: [FormsModule],
  template: `
    <details>
      <summary>Stats (optional)</summary>
      <p>Back text and stats are independent. Values are authored; modifiers and saves are not calculated. Markdown export omits stats.</p>
      @if (!value()) {
        <button type="button" (click)="statsChange.emit({})">Add stats</button>
      } @else {
        <button type="button" (click)="remove()">Remove stats</button>
        <div class="fields">
          @for (field of fields; track field.key) {
            <label>{{ field.label }}<input [ngModel]="value()?.[field.key] ?? ''"
              (ngModelChange)="set(field.key, $event)" /></label>
          }
        </div>
        <fieldset>
          <legend>Abilities — optional authored values</legend>
          @for (ability of abilities; track ability) {
            <div class="ability">
              <strong>{{ ability }}</strong>
              @for (part of abilityParts; track part) {
                <label>{{ part }}<input [attr.aria-label]="ability + ' ' + part"
                  [ngModel]="value()?.abilities?.[ability]?.[part] ?? ''"
                  (ngModelChange)="setAbility(ability, part, $event)" /></label>
              }
            </div>
          }
        </fieldset>
        @for (section of value()?.sections ?? []; track $index; let s = $index) {
          <fieldset>
            <legend>Stat section {{ s + 1 }}</legend>
            <label>Section title<input [ngModel]="section.title ?? ''" (ngModelChange)="sectionTitle(s, $event)" /></label>
            <button type="button" [disabled]="s === 0" (click)="moveSection(s, -1)">Move section up</button>
            <button type="button" [disabled]="s === (value()?.sections?.length ?? 0) - 1" (click)="moveSection(s, 1)">Move section down</button>
            <button type="button" (click)="removeSection(s)">Remove section</button>
            @for (entry of section.entries ?? []; track $index; let e = $index) {
              <fieldset>
                <legend>Entry {{ e + 1 }}</legend>
                @if (entry.spellcasting; as spell) {
                  <label>Spellcasting ability<input [ngModel]="spell.ability ?? ''" (ngModelChange)="spellField(s, e, 'ability', $event)" /></label>
                  <label>Spell save DC (optional)<input [ngModel]="spell.dc ?? ''" (ngModelChange)="spellField(s, e, 'dc', $event)" /></label>
                  <label>Spells<textarea [ngModel]="spell.spells ?? ''" (ngModelChange)="spellField(s, e, 'spells', $event)"></textarea></label>
                } @else {
                  <label>Entry name (optional)<input [ngModel]="entry.name ?? ''" (ngModelChange)="entryField(s, e, { name: $event })" /></label>
                  <label>Entry text<textarea [ngModel]="entry.text ?? ''" (ngModelChange)="entryField(s, e, { text: $event })"></textarea></label>
                }
                <button type="button" [disabled]="e === 0" (click)="moveEntry(s, e, -1)">Move entry up</button>
                <button type="button" [disabled]="e === (section.entries?.length ?? 0) - 1" (click)="moveEntry(s, e, 1)">Move entry down</button>
                <button type="button" (click)="removeEntry(s, e)">Remove entry</button>
              </fieldset>
            }
            <button type="button" (click)="addEntry(s, false)">Add entry</button>
            <button type="button" (click)="addEntry(s, true)">Add spellcasting</button>
          </fieldset>
        }
        <button type="button" (click)="addSection()">Add stat section</button>
      }
    </details>
  `,
  styles: `
    :host { display: block; margin-block: 1rem; }
    summary { cursor: pointer; font-weight: 600; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .6rem; }
    label { display: flex; flex-direction: column; gap: .25rem; margin-block: .35rem; }
    input, textarea { width: 100%; box-sizing: border-box; font: inherit; }
    textarea { min-height: 5rem; }
    fieldset { min-width: 0; margin-block: .75rem; }
    .ability { display: grid; grid-template-columns: 3rem repeat(3, minmax(0, 1fr)); align-items: center; gap: .5rem; }
    button { margin: .25rem; }
  `,
})
export class StatsEditor {
  readonly value = input<DraftStats | null>(null);
  readonly statsChange = output<DraftStats | null>();
  readonly fields = [
    { key: 'subtitle', label: 'Stat subtitle' }, { key: 'ac', label: 'AC' },
    { key: 'hp', label: 'HP' }, { key: 'speed', label: 'Speed' },
    { key: 'initiative', label: 'Initiative' }, { key: 'cr', label: 'CR / level' },
    { key: 'skills', label: 'Skills' }, { key: 'vulnerabilities', label: 'Vulnerabilities' },
    { key: 'resistances', label: 'Resistances' }, { key: 'immunities', label: 'Immunities' },
    { key: 'gear', label: 'Gear' }, { key: 'senses', label: 'Senses' }, { key: 'languages', label: 'Languages' },
  ] as const;
  readonly abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  readonly abilityParts = ['score', 'modifier', 'save'] as const;
  set(key: string, value: string) { this.statsChange.emit({ ...this.value(), [key]: value }); }
  remove() { if (window.confirm('Remove all stats from this draft?')) this.statsChange.emit(null); }
  setAbility(key: string, part: string, value: string) {
    const abilities = { ...this.value()?.abilities };
    abilities[key] = { ...abilities[key], [part]: value };
    this.statsChange.emit({ ...this.value(), abilities });
  }
  sections(sections: DraftStatSection[]) { this.statsChange.emit({ ...this.value(), sections }); }
  private section(s: number, change: Partial<DraftStatSection>) {
    this.sections((this.value()?.sections ?? []).map((v, i) => i === s ? { ...v, ...change } : v));
  }
  addSection() { this.sections([...(this.value()?.sections ?? []), { title: '', entries: [] }]); }
  sectionTitle(s: number, title: string) { this.section(s, { title }); }
  removeSection(s: number) { this.sections((this.value()?.sections ?? []).filter((_, i) => i !== s)); }
  moveSection(s: number, delta: number) {
    const sections = [...(this.value()?.sections ?? [])];
    [sections[s], sections[s + delta]] = [sections[s + delta], sections[s]];
    this.sections(sections);
  }
  private entries(s: number, entries: DraftStatEntry[]) { this.section(s, { entries }); }
  addEntry(s: number, spell: boolean) {
    const entry = spell ? { spellcasting: { ability: '', dc: '', spells: '' } } : { name: '', text: '' };
    this.entries(s, [...(this.value()?.sections?.[s].entries ?? []), entry]);
  }
  entryField(s: number, e: number, change: Partial<DraftStatEntry>) {
    this.entries(s, (this.value()?.sections?.[s].entries ?? []).map((v, i) => i === e ? { ...v, ...change } : v));
  }
  spellField(s: number, e: number, key: string, value: string) {
    this.entryField(s, e, { spellcasting: { ...this.value()?.sections?.[s].entries?.[e].spellcasting, [key]: value } });
  }
  removeEntry(s: number, e: number) { this.entries(s, (this.value()?.sections?.[s].entries ?? []).filter((_, i) => i !== e)); }
  moveEntry(s: number, e: number, delta: number) {
    const entries = [...(this.value()?.sections?.[s].entries ?? [])];
    [entries[e], entries[e + delta]] = [entries[e + delta], entries[e]];
    this.entries(s, entries);
  }
}
