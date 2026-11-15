import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CardLayout, CardLayoutControllerService } from '../../../api/generated';
import { PlayingCard } from './playing-card';
import { DM_CARD_LAYOUT_CLIENT } from '../../dm-card-layout-client';

describe('Playing card', () => {
  const requests: Subject<CardLayout>[] = [];
  beforeEach(() => {
    requests.length = 0;
    TestBed.configureTestingModule({
      providers: [
        DM_CARD_LAYOUT_CLIENT,
        {
          provide: CardLayoutControllerService,
          useValue: {
            calculateCardLayout: vi.fn(() => {
              const request = new Subject<CardLayout>();
              requests.push(request);
              return request;
            }),
          },
        },
      ],
    });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the DM document action by default and permits a document-free card surface', async () => {
    const fixture=TestBed.createComponent(PlayingCard);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button.document')).not.toBeNull();
    fixture.componentRef.setInput('documentAvailable',false);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button.document')).toBeNull();
    expect(fixture.nativeElement.querySelector('button.flip')).not.toBeNull();
  });

  it('exposes complete escaped overflow text outside the card and separates flip, read and select', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    const summary = '<script>secret</script>' + ' Long summary.'.repeat(60);
    fixture.componentRef.setInput('title', '<b>Mira</b>');
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('backText', 'Back <b>literal</b>\nSecond line');
    fixture.componentRef.setInput(
      'tags',
      Array.from({ length: 32 }, (_, i) => `tag-${i}`),
    );
    fixture.componentRef.setInput('selectable', true);
    const select = vi.fn(),
      open = vi.fn();
    fixture.componentInstance.select.subscribe(select);
    fixture.componentInstance.openDocument.subscribe(open);
    await fixture.whenStable();
    requests[0].error(new Error('Offline'));
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.fallback button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('dialog')?.textContent).toContain(summary);
    expect(el.querySelectorAll('dialog li')).toHaveLength(32);
    expect(el.querySelector('script')).toBeNull();
    fixture.componentInstance.closeReader();
    (el.querySelector('.flip') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('back');
    expect(el.querySelector('.document')).toBeNull();
    (el.querySelector('.fallback button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('dialog')?.textContent).toContain('Back <b>literal</b>\nSecond line');
    expect(select).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    fixture.componentInstance.closeReader();
    (el.querySelector('.flip') as HTMLButtonElement).click();
    await fixture.whenStable();
    (el.querySelector('.document') as HTMLButtonElement).click();
    el.querySelector('article')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('resets for changed content/context/selection, preserves unrelated updates and cancels stale layout responses', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    await fixture.whenStable();
    const flip = () => fixture.componentInstance.flip(new Event('click'));
    flip();
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('back');
    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('context', 'another-location');
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('front');
    flip();
    fixture.componentRef.setInput('selected', true);
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('front');
    flip();
    fixture.componentRef.setInput('summary', 'New revision');
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('front');
    expect(requests[0].observed).toBe(false);
    requests[0].next({ profile: 'stale' } as CardLayout);
    expect(fixture.componentInstance.layout()).toBeNull();
    flip();
    fixture.componentRef.setInput('artwork', { key: 'image-one', load: () => new Subject<Blob>() });
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('front');
    flip();
    fixture.componentRef.setInput('artwork', { key: 'image-one', load: () => new Subject<Blob>() });
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('back');
    fixture.componentRef.setInput('localArtwork', 'blob:new-image');
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('front');
  });
});

// CFP-R2.1–R2.3: visible defaults, independent viewers, stable display lifecycle,
// controls and complete escaped reading; geometry remains authoritative.
describe('CF2 viewer-local front text', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DM_CARD_LAYOUT_CLIENT, {
      provide: CardLayoutControllerService,
      useValue: { calculateCardLayout: vi.fn(() => new Subject<CardLayout>()) },
    }] });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('preserves hidden text across flips, selection and revisions without changing another viewer', async () => {
    const first = TestBed.createComponent(PlayingCard);
    const second = TestBed.createComponent(PlayingCard);
    for (const fixture of [first, second]) {
      fixture.componentRef.setInput('context', 'card:revision1');
      fixture.componentRef.setInput('visibilityKey', 'card');
      fixture.componentRef.setInput('quote', '<b>Literal quote</b>');
      fixture.componentRef.setInput('selectable', true);
      await fixture.whenStable();
    }
    const select = vi.fn();
    first.componentInstance.select.subscribe(select);
    const control = first.nativeElement.querySelector('.text-visibility') as HTMLButtonElement;
    expect(control.textContent).toContain('Hide text');
    control.click();
    await first.whenStable();
    expect(control.textContent).toContain('Show text');
    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(first.nativeElement.querySelector('.fallback')).toBeNull();
    expect(first.nativeElement.querySelector('.document')).not.toBeNull();
    expect(second.componentInstance.textVisible()).toBe(true);
    expect(select).not.toHaveBeenCalled();
    first.componentInstance.flip(new Event('click'));
    await first.whenStable();
    expect(first.componentInstance.side()).toBe('back');
    expect(first.nativeElement.querySelector('.fallback')).not.toBeNull();
    first.componentInstance.flip(new Event('click'));
    first.componentRef.setInput('selected', true);
    first.componentRef.setInput('context', 'card:revision2');
    first.componentRef.setInput('summary', 'Updated summary');
    await first.whenStable();
    expect(first.componentInstance.textVisible()).toBe(false);
    expect(first.componentInstance.content()).toContain('<b>Literal quote</b>');
    expect(first.nativeElement.querySelector('dialog')?.textContent).toContain('<b>Literal quote</b>');
    expect(first.nativeElement.querySelector('dialog b')).toBeNull();
    first.componentRef.setInput('visibilityKey', 'another-card');
    await first.whenStable();
    expect(first.componentInstance.textVisible()).toBe(true);
    first.destroy();
    const reopened = TestBed.createComponent(PlayingCard);
    await reopened.whenStable();
    expect(reopened.componentInstance.textVisible()).toBe(true);
  });

  it('stops pointer, touch and keyboard activation from reaching card selection or drag handlers', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    await fixture.whenStable();
    const article = fixture.nativeElement.querySelector('article') as HTMLElement;
    const received = vi.fn();
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) article.addEventListener(type, received);
    const control = fixture.nativeElement.querySelector('.text-visibility') as HTMLButtonElement;
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) {
      control.dispatchEvent(new Event(type, { bubbles: true }));
    }
    expect(received).not.toHaveBeenCalled();
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    control.click();
    expect(fixture.componentInstance.textVisible()).toBe(true);
  });
});
