import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ArtworkImage } from './artwork-image';

describe('Artwork lifetimes', () => {
  afterEach(() => vi.restoreAllMocks());
  it('cancels old identity reads, retries failures and releases URLs on hide and destruction', async () => {
    let visibility!: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          visibility = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:last');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fixture = TestBed.createComponent(ArtworkImage);
    const late = new Subject<Blob>();
    const oldLoad = vi.fn(() => late);
    fixture.componentRef.setInput('source', { key: 'old', load: oldLoad });
    await fixture.whenStable();
    expect(oldLoad).not.toHaveBeenCalled();
    const visible = (value: boolean) =>
      visibility(
        [{ isIntersecting: value } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    visible(true);
    await fixture.whenStable();
    expect(oldLoad).toHaveBeenCalledTimes(1);
    const load = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of(new Blob(['new'])));
    fixture.componentRef.setInput('source', { key: 'new', load });
    await fixture.whenStable();
    late.next(new Blob(['stale']));
    expect(create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Artwork unavailable');
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img').src).toBe('blob:first');
    visible(false);
    await fixture.whenStable();
    expect(revoke).toHaveBeenCalledWith('blob:first');
    visible(true);
    await fixture.whenStable();
    fixture.destroy();
    expect(revoke).toHaveBeenCalledWith('blob:last');
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
