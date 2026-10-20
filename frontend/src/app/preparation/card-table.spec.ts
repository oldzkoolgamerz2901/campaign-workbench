import { TestBed } from '@angular/core/testing';
import { CardTable } from './card-table';
import { PreparedItemData } from '../../api/generated';

const item = (id: string, type?: string): PreparedItemData =>
  ({
    id,
    title: id,
    provenance: { path: `${id}.md` },
    capturedSource: type ? { classification: { metadata: { type } } } : null,
  }) as PreparedItemData;
describe('Play groups', () => {
  it('combines type and text across active/used without changing input order or guessing legacy types', async () => {
    const fixture = TestBed.createComponent(CardTable);
    const table = { active: ['scene', 'npc', 'legacy'], used: ['used-npc'] };
    fixture.componentRef.setInput('items', [
      item('scene', 'scene'),
      item('npc', 'npc'),
      item('legacy'),
      item('used-npc', 'npc'),
    ]);
    fixture.componentRef.setInput('table', table);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component.active().map((i) => i.id)).toEqual(table.active);
    fixture.componentRef.setInput('group', 'npc');
    await fixture.whenStable();
    expect(component.active().map((i) => i.id)).toEqual(['npc']);
    expect(component.used().map((i) => i.id)).toEqual(['used-npc']);
    const moved = vi.fn();
    component.moveItem.subscribe(moved);
    component.dropActive({ item: { data: 'npc' }, currentIndex: 0 } as never);
    expect(moved).not.toHaveBeenCalled();
    fixture.componentRef.setInput('query', 'used-');
    await fixture.whenStable();
    expect(component.active()).toEqual([]);
    expect(component.used().map((i) => i.id)).toEqual(['used-npc']);
    fixture.componentRef.setInput('group', '');
    fixture.componentRef.setInput('query', '');
    await fixture.whenStable();
    expect(component.active().map((i) => i.id)).toEqual(['scene', 'npc', 'legacy']);
    expect(component.table()).toBe(table);
  });
});
