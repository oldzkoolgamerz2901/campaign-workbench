import { TestBed } from '@angular/core/testing';
import { CARD_FONTS, CardLayout } from './card-layout';
import { CardLayoutRenderer } from './card-layout-renderer';

function layout(): CardLayout {
  return {
    profile: 'physical-card-1',
    width: 243,
    height: 420,
    fonts: Object.fromEntries(Object.entries(CARD_FONTS).map(([key, font]) => [key, font.hash])),
    front: { fits: true, lines: [], boxes: [], issues: [] },
    back: { fits: false, lines: [], boxes: [], issues: [{ field: 'backText', code: 'overflow' }] },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Canonical card renderer', () => {
  it('rejects a different profile before loading a substitute font', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const fixture = TestBed.createComponent(CardLayoutRenderer);
    fixture.componentRef.setInput('layout', { ...layout(), profile: 'unknown' });
    await fixture.whenStable();
    expect(fixture.componentInstance.status()).toBe('profile-mismatch');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a non-fitting side without partial text rendering', async () => {
    const fixture = TestBed.createComponent(CardLayoutRenderer);
    fixture.componentRef.setInput('layout', layout());
    fixture.componentRef.setInput('side', 'back');
    await fixture.whenStable();
    expect(fixture.componentInstance.status()).toBe('non-fitting');
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('text')).toHaveLength(0);
  });

  it('ignores late font failure after the displayed side changes and escapes authored markup', async () => {
    let reject!: (reason: Error) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      ),
    );
    const fixture = TestBed.createComponent(CardLayoutRenderer);
    const value = layout();
    value.front.lines = [
      {
        field: 'title',
        text: '<script>plain text</script>',
        font: 'TITLE',
        size: 16,
        x: 14,
        baseline: 270,
        width: 100,
        ascent: 16,
        descent: 4,
      },
    ];
    fixture.componentRef.setInput('layout', value);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.querySelector('text').textContent).toBe(
      '<script>plain text</script>',
    );
    fixture.componentRef.setInput('side', 'back');
    await fixture.whenStable();
    reject(new Error('Delayed network failure'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fixture.componentInstance.status()).toBe('non-fitting');
  });
});
