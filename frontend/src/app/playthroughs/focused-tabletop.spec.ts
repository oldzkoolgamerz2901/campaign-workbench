import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PreparedItemData, WorkspaceData } from '../../api/generated';
import { FocusedTabletop } from './focused-tabletop';

const item = (id: string, type?: string) =>
  ({
    id,
    title: id,
    provenance: { path: id },
    capturedSource: type ? { classification: { metadata: { type, title: id }, issues: [] } } : null,
  }) as PreparedItemData;
const workspace: WorkspaceData = {
  session: 'session',
  revision: 2,
  active: ['scene', 'npc', 'fourth'],
  used: ['item'],
  activeSceneItemId: 'scene',
  focusedItemIds: ['scene', 'npc', 'item'],
};

describe('Focused tabletop presentation', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const fixture = TestBed.createComponent(FocusedTabletop);
    fixture.componentRef.setInput('campaign', 'campaign');
    fixture.componentRef.setInput('session', 'session');
    fixture.componentRef.setInput('items', [
      item('scene', 'scene'),
      item('npc', 'npc'),
      item('item', 'item'),
      item('fourth', 'scene'),
    ]);
    fixture.componentRef.setInput('workspace', workspace);
    await fixture.whenStable();
    return fixture;
  }
  it('renders ordered shared cards and a Used marker without changing the supplied arrangement', async () => {
    const fixture = await setup();
    const slots = fixture.nativeElement.querySelectorAll('[data-focus-slot]');
    expect(Array.from(slots).map((node: any) => node.dataset.itemId)).toEqual([
      'scene',
      'npc',
      'item',
    ]);
    expect(slots[2].textContent).toContain('Used');
    expect(fixture.nativeElement.querySelectorAll('playing-card')).toHaveLength(3);
    expect(fixture.componentInstance.workspace()).toBe(workspace);
  });
  it('offers explicit slot replacement during fourth-card inspection without emitting activation or focus', async () => {
    const fixture = await setup(),
      component = fixture.componentInstance;
    const replace = vi.fn(),
      activate = vi.fn(),
      focus = vi.fn();
    component.replaceFocus.subscribe(replace);
    component.activateScene.subscribe(activate);
    component.focusItem.subscribe(focus);
    fixture.componentRef.setInput('inspection', 'fourth');
    await fixture.whenStable();
    const inspection = fixture.nativeElement.querySelector('[aria-label="Temporary inspection"]');
    expect(fixture.nativeElement.querySelectorAll('playing-card')).toHaveLength(4);
    const buttons = Array.from(inspection.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('Replace focus 2'))!.click();
    expect(replace).toHaveBeenCalledWith({ slot: 1, id: 'fourth' });
    expect(activate).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(component.workspace()).toBe(workspace);
  });
  it('keeps quick focus access and one-action return while the existing reader is expanded', async () => {
    const fixture = await setup(),
      component = fixture.componentInstance;
    const back = vi.fn(),
      expand = vi.fn();
    component.returnToCards.subscribe(back);
    component.expandItem.subscribe(expand);
    fixture.componentRef.setInput('expanded', 'scene');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('playing-card')).toHaveLength(0);
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('nav button'),
    ) as HTMLButtonElement[];
    expect(buttons).toHaveLength(4);
    buttons[2].click();
    expect(expand).toHaveBeenCalledWith('npc');
    buttons[0].click();
    expect(back).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('expanded', null);
    await fixture.whenStable();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Expand: scene');
  });
});
