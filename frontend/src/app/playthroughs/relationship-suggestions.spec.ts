import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PreparedItemData, WorkspaceData } from '../../api/generated';
import { RelationshipSuggestions } from './relationship-suggestions';

const workspace: WorkspaceData = {
  session: 'session',
  revision: 1,
  active: ['scene', 'copy2'],
  used: ['copy1'],
  activeSceneItemId: 'scene',
  focusedItemIds: ['scene'],
};
const response = {
  scene: 'scene',
  suggestions: ['copy1', 'copy2'].map((item) => ({
    key: `scene-item-${item}`,
    destination: item,
    state: 'MATCHED',
    candidates: [{ item, anchor: null }],
  })),
};

describe('Relationship suggestions', () => {
  async function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(RelationshipSuggestions);
    fixture.componentRef.setInput('campaign', 'campaign');
    fixture.componentRef.setInput('session', 'session');
    fixture.componentRef.setInput('workspace', workspace);
    fixture.componentRef.setInput(
      'items',
      ['scene', 'copy1', 'copy2'].map((id) => ({ id, title: id })) as PreparedItemData[],
    );
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    return { fixture, http };
  }
  it('retains exact endpoints and Used indicators and emits only explicit commands', async () => {
    const { fixture, http } = await setup();
    http.expectOne((r) => r.url.endsWith('/suggestions')).flush(response);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Used');
    const focus = vi.fn(),
      inspect = vi.fn();
    fixture.componentInstance.focusItem.subscribe(focus);
    fixture.componentInstance.openTarget.subscribe(inspect);
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    buttons.find((b) => b.textContent?.includes('Focus: copy1'))!.click();
    expect(focus).toHaveBeenCalledWith('copy1');
    buttons.find((b) => b.textContent?.includes('Inspect: copy2'))!.click();
    expect(inspect).toHaveBeenCalledWith('@copy2#');
    http.expectNone((r) => r.method !== 'GET');
    http.verify();
  });
  it('full focus exposes inspection, cancels departed requests, and offers independent retry', async () => {
    const { fixture, http } = await setup();
    const old = http.expectOne((r) => r.url.endsWith('/suggestions'));
    fixture.componentRef.setInput('workspace', {
      ...workspace,
      activeSceneItemId: 'other',
      focusedItemIds: ['scene', 'copy1', 'third'],
    });
    await fixture.whenStable();
    expect(old.cancelled).toBe(true);
    http
      .expectOne((r) => r.params.get('scene') === 'other')
      .flush('failed', { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    http.expectOne((r) => r.params.get('scene') === 'other').flush({ ...response, scene: 'other' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Focus:');
    expect(fixture.nativeElement.textContent).toContain('Inspect: copy2');
    fixture.componentRef.setInput('workspace', { ...workspace, activeSceneItemId: null });
    await fixture.whenStable();
    expect(fixture.componentInstance.suggestions()).toEqual([]);
    http.verify();
  });
});
