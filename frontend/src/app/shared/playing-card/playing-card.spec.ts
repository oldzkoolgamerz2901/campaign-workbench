import { TestBed } from '@angular/core/testing';
import { PlayingCard } from './playing-card';

describe('Playing card', () => {
  it('keeps the authored summary and all tags, escapes markup, and opens the full reader', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    const summary = '<script>secret</script>' + ' Long summary.'.repeat(60);
    fixture.componentRef.setInput('title', '<b>Mira</b>');
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput(
      'tags',
      Array.from({ length: 32 }, (_, i) => `tag-${i}`),
    );
    let opened = false;
    fixture.componentInstance.openDocument.subscribe(() => (opened = true));
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.card-text')?.textContent).toContain(summary);
    expect(el.querySelectorAll('li')).toHaveLength(32);
    expect(el.querySelector('script')).toBeNull();
    el.querySelector('button')!.click();
    expect(opened).toBe(true);
    fixture.componentRef.setInput('summary', '');
    await fixture.whenStable();
    expect(el.textContent).toContain('No summary yet');
  });
  it('selects opt-in cards by face click and keyboard without double activating the document action', async () => {
    const fixture = TestBed.createComponent(PlayingCard);
    fixture.componentRef.setInput('title', 'Mira');
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('selected', true);
    const select = vi.fn(),
      open = vi.fn();
    fixture.componentInstance.select.subscribe(select);
    fixture.componentInstance.openDocument.subscribe(open);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const card = el.querySelector('article')!;
    el.querySelector('img')!.click();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(select).toHaveBeenCalledTimes(3);
    expect(card.getAttribute('aria-current')).toBe('true');
    el.querySelector('button')!.click();
    expect(open).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(3);
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    el.querySelector('img')!.click();
    expect(select).toHaveBeenCalledTimes(3);
  });
});
