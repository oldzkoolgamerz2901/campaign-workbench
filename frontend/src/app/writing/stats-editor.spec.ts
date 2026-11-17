import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DraftStats } from '../../api/generated';
import { StatsEditor } from './stats-editor';

@Component({
  imports: [StatsEditor],
  template: '<stats-editor [value]="stats()" (statsChange)="stats.set($event)" />',
})
class Host {
  readonly stats = signal<DraftStats | null>({ ac: '12', sections: [{ title: 'Traits', entries: [{ name: 'Watchful', text: 'Retain me' }] }] });
}

describe('Stats authoring', () => {
  it('CD5 native blur/change events cannot replace stats and edits retain ordered sections', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = 'Medium Humanoid';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.stats()).toMatchObject({ subtitle: 'Medium Humanoid', ac: '12', sections: [{ title: 'Traits', entries: [{ text: 'Retain me' }] }] });
  });
});
