import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { App } from './app';
import { Status } from './platform/status';

describe('Availability checks', () => {
  const check = vi.fn();
  beforeEach(() => {
    check.mockReset();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: Status, useValue: { check } }],
    });
  });
  it('automatically checks startup and foreground return without a permanent healthy indicator', async () => {
    check.mockReturnValue(of({ status: 'ready' }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(check).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
    fixture.componentInstance.foreground();
    expect(check).toHaveBeenCalledTimes(2);
  });
  it('keeps a failed availability check visible until retry succeeds', async () => {
    check
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of({ status: 'ready' }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'Backend unavailable',
    );
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
  });
});
