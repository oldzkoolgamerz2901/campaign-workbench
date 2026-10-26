import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CardLayout, CardLayoutControllerService } from '../../../api/generated';
import { PlayingCard } from './playing-card';

describe('Playing card', () => {
  const requests: Subject<CardLayout>[] = [];
  beforeEach(() => {
    requests.length = 0;
    TestBed.configureTestingModule({
      providers: [
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
