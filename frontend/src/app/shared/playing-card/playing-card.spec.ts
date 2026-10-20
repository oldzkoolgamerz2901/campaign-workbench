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
});
