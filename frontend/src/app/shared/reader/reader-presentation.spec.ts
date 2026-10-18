import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { MarkdownView } from '../../preparation/markdown-view';
import { ReaderPresentation, revealReaderTarget } from './reader-presentation';
import { By } from '@angular/platform-browser';

const html =
  '<h1>Card</h1><p>Introduction</p><h2>Quick reference</h2><p>Quick facts</p><h2>Read aloud</h2><p>Exact prose</p><h2>Mechanics</h2><p>Roll dice</p><h2> Background </h2><p>Hidden evidence</p><h3>Nested</h3><p>Nested evidence</p><h2>DM Notes</h2><p>Unknown remains visible</p><h2>Design notes</h2><p>Hidden design</p>';
const anchors = [
  'card',
  'quick-reference',
  'read-aloud',
  'mechanics',
  'background',
  'nested',
  'dm-notes',
  'design-notes',
];
describe('Rendered reader presentation', () => {
  let fixture: ComponentFixture<MarkdownView>;
  let reader: ReaderPresentation;
  const text = (content: string) =>
    Array.from(fixture.nativeElement.querySelectorAll('p') as NodeListOf<HTMLElement>).find(
      (p) => p.textContent === content,
    )!;
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MarkdownView] });
    fixture = TestBed.createComponent(MarkdownView);
    fixture.componentRef.setInput('identity', 'card-a');
    fixture.componentRef.setInput('typed', true);
    fixture.componentRef.setInput('readingTools', true);
    fixture.componentRef.setInput('content', { html, anchors, links: [] });
    await fixture.whenStable();
    reader = fixture.debugElement
      .query(By.directive(ReaderPresentation))
      .injector.get(ReaderPresentation);
    for (const h of reader.headings()) h.element.scrollIntoView = vi.fn();
  });
  it('collapses only named background/design subtrees and distinguishes exact read-aloud/mechanics headings', () => {
    expect(text('Hidden evidence').hidden).toBe(true);
    expect(text('Nested evidence').hidden).toBe(true);
    expect(text('Hidden design').hidden).toBe(true);
    expect(text('Unknown remains visible').hidden).toBe(false);
    expect(text('Exact prose').getAttribute('data-reader-role')).toBe('read aloud');
    expect(text('Roll dice').getAttribute('data-reader-role')).toBe('mechanics');
    expect(reader.headings().map((h) => h.key)).toEqual(anchors);
  });
  it('reveals collapsed ancestors before exact targets and leaves heading order intact', () => {
    const nested = reader.headings()[5].element;
    expect(nested.hidden).toBe(true);
    revealReaderTarget(nested);
    expect(nested.hidden).toBe(false);
    expect(text('Nested evidence').hidden).toBe(false);
    reader.focus(2);
    expect(text('Exact prose').hidden).toBe(false);
    expect(text('Quick facts').hidden).toBe(true);
    reader.go(5);
    expect(reader.focused()).toBeNull();
    expect(nested.scrollIntoView).toHaveBeenCalled();
    reader.expandAll();
    expect(Array.from(fixture.nativeElement.querySelectorAll('.markdown [hidden]'))).toEqual([]);
  });
  it('keeps legacy/invalid cards visible and preserves local disclosure choices on unchanged rendered text', async () => {
    reader.expandAll();
    fixture.componentRef.setInput('content', { html, anchors, links: [] });
    await fixture.whenStable();
    expect(text('Hidden evidence').hidden).toBe(false);
    fixture.componentRef.setInput('identity', 'legacy');
    fixture.componentRef.setInput('typed', false);
    await fixture.whenStable();
    expect(text('Hidden design').hidden).toBe(false);
    expect(reader.headings().some((h) => h.collapsible)).toBe(false);
    expect(text('Exact prose').hasAttribute('data-reader-role')).toBe(false);
  });
  it('leaves ambiguous nested/duplicate canonical headings visible and disables unsafe focus', async () => {
    fixture.componentRef.setInput('identity', 'ambiguous');
    fixture.componentRef.setInput('content', {
      html: '<h1>Card</h1><h2>Background</h2><p>First</p><blockquote><h3>Nested heading</h3><p>Quoted</p></blockquote><h2>Background</h2><p>Second</p>',
      anchors: ['card', 'background', 'nested-heading', 'background-1'],
      links: [],
    });
    await fixture.whenStable();
    expect(reader.canFocus()).toBe(false);
    expect(reader.headings().some((h) => h.collapsible)).toBe(false);
    reader.focus(1);
    expect(reader.focused()).toBeNull();
    expect(text('First').hidden).toBe(false);
    expect(text('Second').hidden).toBe(false);
  });
  it('uses returned anchor order for repeated heading links and retains unavailable/external link behavior', async () => {
    fixture.componentRef.setInput('identity', 'repeated');
    fixture.componentRef.setInput('content', {
      html: '<h1>Card</h1><p><a href="#exact">exact</a> <a href="#missing">missing</a> <a href="#external">external</a></p><h2>Background</h2><h3>Repeat</h3><p>First</p><h3>Repeat</h3><p>Second</p>',
      anchors: ['card', 'background', 'repeat', 'repeat-1'],
      links: [
        { key: 'exact', target: 'repeat-1', external: null, unavailable: false },
        { key: 'missing', target: null, external: null, unavailable: true },
        { key: 'external', target: null, external: 'https://example.test/', unavailable: false },
      ],
    });
    await fixture.whenStable();
    for (const h of reader.headings()) h.element.scrollIntoView = vi.fn();
    fixture.nativeElement.querySelector('a[href="#exact"]').click();
    expect(reader.headings()[3].element.scrollIntoView).toHaveBeenCalled();
    expect(text('Second').hidden).toBe(false);
    fixture.nativeElement.querySelector('a[href="#missing"]').click();
    expect(fixture.componentInstance.notice()).toContain('outside the captured');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    expect(open).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('a[href="#external"]').click();
    expect(open).toHaveBeenCalledWith('https://example.test/', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});
