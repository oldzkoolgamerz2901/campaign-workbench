import { Component, input } from '@angular/core';
import { LayoutStats } from '../../../api/generated';

/** Complete permitted stats inside the owning card's single Details surface. */
@Component({
  selector: 'stats-reader',
  template: `
    <section aria-label="Structured stats">
      <h4>Stats</h4>
      @if (value().subtitle) { <p>{{ value().subtitle }}</p> }
      <dl>
        @for (field of fields; track field.key) {
          @if (value()[field.key]; as text) { <dt>{{ field.label }}</dt><dd>{{ text }}</dd> }
        }
      </dl>
      @if (hasAbilities()) {
        @let values = value().abilities!;
        <table aria-label="Abilities">
          <thead><tr><th>Ability</th><th>Score</th><th>Mod</th><th>Save</th></tr></thead>
          <tbody>
            @for (key of abilities; track key) {
              @if (values[key]; as a) { <tr><th>{{ key }}</th><td>{{ a.score || '—' }}</td><td>{{ a.modifier || '—' }}</td><td>{{ a.save || '—' }}</td></tr> }
            }
          </tbody>
        </table>
      }
      @for (section of value().sections ?? []; track $index) {
        @if (section.entries?.length) {
          @if (section.title) { <h5>{{ section.title }}</h5> }
          @for (entry of section.entries ?? []; track $index) {
            @if (entry.spellcasting; as spell) {
              <p><strong>Spellcasting</strong> {{ spell.ability }} @if (spell.dc) { · DC {{ spell.dc }} }</p>
              <p>{{ spell.spells }}</p>
            } @else if (entry.name || entry.text) {
              <p>@if (entry.name) { <strong>{{ entry.name }}.</strong> } {{ entry.text }}</p>
            }
          }
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    p, dd { white-space: pre-wrap; overflow-wrap: anywhere; }
    dl { display: grid; grid-template-columns: minmax(5rem, auto) minmax(0, 1fr); gap: .3rem .75rem; }
    dt { font-weight: 600; } dd { margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: .3rem; overflow-wrap: anywhere; }
    tbody tr:nth-child(odd) { background: #ddd7c2; }
    h5 { font-size: inherit; color: #420000; border-bottom: 1px solid #766a56; margin-bottom: .4rem; }
  `,
})
export class StatsReader {
  readonly value = input.required<LayoutStats>();
  hasAbilities() { return Object.keys(this.value().abilities ?? {}).length > 0; }
  readonly abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  readonly fields = [
    { key: 'ac', label: 'AC' }, { key: 'hp', label: 'HP' }, { key: 'speed', label: 'Speed' },
    { key: 'initiative', label: 'Initiative' }, { key: 'cr', label: 'CR / level' },
    { key: 'skills', label: 'Skills' }, { key: 'vulnerabilities', label: 'Vulnerabilities' },
    { key: 'resistances', label: 'Resistances' }, { key: 'immunities', label: 'Immunities' },
    { key: 'gear', label: 'Gear' }, { key: 'senses', label: 'Senses' }, { key: 'languages', label: 'Languages' },
  ] as const;
}
