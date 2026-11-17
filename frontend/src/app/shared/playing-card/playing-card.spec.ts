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

  it('CD5 sends only permitted stats to layout and renders complete literal stats in the single Details dialog', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    fixture.componentRef.setInput('stats', { ac: '17', sections: [{ title: 'Traits', entries: [{ name: 'Watchful', text: '<b>SECRET_STAT</b>' }] }] });
    fixture.componentRef.setInput('backRevealed', false);
    await fixture.whenStable();
    const api = TestBed.inject(CardLayoutControllerService);
    expect(vi.mocked(api.calculateCardLayout).mock.calls.at(-1)?.[0].stats).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('SECRET_STAT');
    fixture.componentRef.setInput('backRevealed', true);
    await fixture.whenStable();
    expect(vi.mocked(api.calculateCardLayout).mock.calls.at(-1)?.[0].stats?.ac).toBe('17');
    expect(fixture.nativeElement.querySelectorAll('dialog')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('stats-reader').textContent).toContain('<b>SECRET_STAT</b>');
    expect(fixture.nativeElement.querySelector('stats-reader b')).toBeNull();
  });

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
    (el.querySelector('.details') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('dialog')?.textContent).toContain(summary);
    expect(el.querySelectorAll('dialog li')).toHaveLength(32);
    expect(el.querySelector('script')).toBeNull();
    fixture.componentInstance.closeDetails();
    (el.querySelector('.flip') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.side()).toBe('back');
    expect(el.querySelector('.document')).toBeNull();
    (el.querySelector('.details') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('dialog')?.textContent).toContain('Back <b>literal</b>\nSecond line');
    expect(select).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    fixture.componentInstance.closeDetails();
    (el.querySelector('.flip') as HTMLButtonElement).click();
    await fixture.whenStable();
    (el.querySelector('.document') as HTMLButtonElement).click();
    el.querySelector('article')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('withholds non-front content from layout requests and Details while retaining title quote and flip', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    fixture.componentRef.setInput('title', 'Visible title');
    fixture.componentRef.setInput('quote', 'Visible quote');
    fixture.componentRef.setInput('backRevealed', false);
    fixture.componentRef.setInput('backText', 'PRIVATE_BACK');
    fixture.componentRef.setInput('summary', 'PRIVATE_SUMMARY');
    fixture.componentRef.setInput('tags', ['PRIVATE_TAG']);
    await fixture.whenStable();
    const payload = JSON.parse(fixture.componentInstance.content());
    expect(payload.backText).toBe('Back not revealed');
    expect(payload.summary).toBe('');
    expect(payload.tags).toEqual([]);
    requests[0].error(new Error('Offline'));
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('.details') as HTMLButtonElement).click();
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Back not revealed');
    expect(fixture.nativeElement.textContent).not.toContain('PRIVATE_');
    fixture.componentInstance.closeDetails();
    fixture.componentInstance.flip(new Event('click'));
    expect(fixture.componentInstance.side()).toBe('back');
    fixture.componentRef.setInput('backRevealed', true);
    await fixture.whenStable();
    expect(JSON.parse(fixture.componentInstance.content()).backText).toBe('PRIVATE_BACK');
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('PRIVATE_BACK');
  });

  it('CD4 offers one image-only Details window before reveal and preserves reading for equivalent image loaders', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    fixture.componentRef.setInput('backRevealed', false);
    fixture.componentRef.setInput('backText', 'PRIVATE_IMAGE_BACK');
    fixture.componentRef.setInput('detailsImage', { key: 'map:one', load: () => new Subject<Blob>() });
    await fixture.whenStable();
    const details = fixture.nativeElement.querySelector('.details') as HTMLButtonElement;
    expect(details).not.toBeNull();
    details.click();
    expect(fixture.nativeElement.querySelectorAll('dialog')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('dialog artwork-image')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('PRIVATE_IMAGE_BACK');
    fixture.componentRef.setInput('detailsImage', { key: 'map:one', load: () => new Subject<Blob>() });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog').hasAttribute('open')).toBe(true);
    fixture.componentRef.setInput('detailsImage', { key: 'map:two', load: () => new Subject<Blob>() });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog').hasAttribute('open')).toBe(false);
  });

  it('closes stale Details when the displayed content changes', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    fixture.componentRef.setInput('backText', 'Original back');
    await fixture.whenStable();
    requests[0].error(new Error('Offline'));
    await fixture.whenStable();
    const details = fixture.nativeElement.querySelector('.details') as HTMLButtonElement;
    details.click();
    expect(fixture.nativeElement.querySelector('dialog').hasAttribute('open')).toBe(true);
    fixture.componentRef.setInput('backText', 'New back');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog').hasAttribute('open')).toBe(false);
    expect(fixture.nativeElement.querySelector('dialog').textContent).not.toContain('Original back');
    expect(requests[0].observed).toBe(false);
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
