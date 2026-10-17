import { Component } from '@angular/core';
import { CampaignLibrary } from './campaigns/library';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { App } from './app';
import { Status } from './platform/status';

@Component({ selector: 'campaign-library', template: '' })
class LibraryStub {}

describe('Connection check', () => {
  const check = vi.fn();
  beforeEach(() => {
    check.mockReset();
    TestBed.overrideComponent(App, { remove: { imports: [CampaignLibrary] }, add: { imports: [LibraryStub] } });
    TestBed.configureTestingModule({ imports: [App], providers: [{ provide: Status, useValue: { check } }] });
  });
  it('checks only after an explicit action and displays the response', async () => {
    check.mockReturnValue(of({ status: 'ready' }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(check).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain('Connected');
  });
  it('shows a failed connection without claiming success', async () => {
    check.mockReturnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain('Unavailable');
  });
});
