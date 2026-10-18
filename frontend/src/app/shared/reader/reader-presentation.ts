import {
  Directive,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { SourceSection } from '../../../api/generated';

const headingSelector = 'h1,h2,h3,h4,h5,h6';
const normalized = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();
const roles = new Set(['quick reference', 'read aloud', 'mechanics', 'background', 'design notes']);
const readers = new WeakMap<Element, ReaderPresentation>();
let nextReader = 0;
export interface ReaderHeading {
  key: string;
  title: string;
  level: number;
  element: HTMLElement;
  end: number;
  collapsible: boolean;
  controls: string;
}
interface ReaderUnit {
  element: HTMLElement;
  owner: number;
  heading: boolean;
}

// Reveal presentation state before the existing exact source/captured target receives focus.
export function revealReaderTarget(target: HTMLElement) {
  const root = target.closest('[data-reader-root]');
  if (root) readers.get(root)?.revealElement(target);
}

@Directive({
  selector: '[readerPresentation]',
  exportAs: 'readerPresentation',
  host: { class: 'reader-content', '[attr.data-reader-root]': 'id' },
})
export class ReaderPresentation implements OnDestroy {
  readonly readerPresentation = input<unknown>();
  readonly content = input<unknown>();
  readonly typed = input(false);
  readonly enabled = input(true);
  readonly sections = input<SourceSection[] | null>(null);
  readonly anchors = input<string[]>([]);
  readonly headings = signal<ReaderHeading[]>([]);
  readonly collapsed = signal<Set<number>>(new Set());
  readonly focused = signal<number | null>(null);
  readonly active = signal<number | null>(null);
  readonly canFocus = signal(true);
  readonly id = `reader-${++nextReader}`;
  private readonly root: HTMLElement = inject(ElementRef).nativeElement;
  private units: ReaderUnit[] = [];
  private wrappers: { element: HTMLElement; owner: number }[] = [];
  private previous: unknown = Symbol();

  constructor() {
    readers.set(this.root, this);
    afterRenderEffect(() => {
      const identity = this.readerPresentation(),
        content = this.content(),
        typed = this.typed(),
        sections = this.sections(),
        anchors = this.anchors(),
        enabled = this.enabled();
      untracked(() => this.build(identity, content, typed, sections, anchors, enabled));
    });
  }
  ngOnDestroy() {
    readers.delete(this.root);
  }
  private build(
    identity: unknown,
    _content: unknown,
    typed: boolean,
    sections: SourceSection[] | null,
    anchors: string[],
    enabled: boolean,
  ) {
    const reset = identity !== this.previous;
    this.previous = identity;
    this.units = [];
    this.wrappers = [];
    const headings: ReaderHeading[] = [];
    let safe = true;
    if (sections) {
      for (const section of sections) {
        const wrapper = Array.from(this.root.children).find((node) => node.id === section.id) as
          | HTMLElement
          | undefined;
        if (!wrapper) continue;
        const heading = wrapper.querySelector<HTMLElement>(headingSelector);
        const owner = heading && section.level ? headings.length : -1;
        if (owner >= 0)
          headings.push({
            key: section.id,
            title: section.heading,
            level: section.level!,
            element: heading!,
            end: 0,
            collapsible: false,
            controls: '',
          });
        this.wrappers.push({ element: wrapper, owner });
        for (const child of Array.from(wrapper.children)) {
          if (!(child instanceof HTMLElement)) continue;
          const isHeading = !!heading && child.contains(heading);
          if (child.querySelectorAll(headingSelector).length > (isHeading ? 1 : 0)) safe = false;
          this.units.push({
            element: child,
            owner,
            heading: isHeading || child.matches('[data-section-action]'),
          });
        }
      }
    } else {
      const all = Array.from(this.root.querySelectorAll<HTMLElement>(headingSelector));
      // Anchor order is backend-owned, including headings nested in blockquotes/lists.
      safe = all.length === anchors.length && all.every((h) => h.parentElement === this.root);
      let owner = -1;
      for (const child of Array.from(this.root.children)) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.matches(headingSelector)) owner = all.indexOf(child);
        this.units.push({ element: child, owner, heading: child.matches(headingSelector) });
      }
      for (const [index, heading] of all.entries())
        headings.push({
          key: anchors[index] ?? `${index}`,
          title: heading.textContent ?? '',
          level: Number(heading.tagName.slice(1)),
          element: heading,
          end: 0,
          collapsible: false,
          controls: '',
        });
    }
    const counts = new Map<string, number>();
    for (const h of headings)
      counts.set(normalized(h.title), (counts.get(normalized(h.title)) ?? 0) + 1);
    for (const [index, h] of headings.entries()) {
      h.end = headings.findIndex((next, i) => i > index && next.level <= h.level);
      if (h.end < 0) h.end = headings.length;
      const role = normalized(h.title);
      h.collapsible =
        enabled &&
        typed &&
        safe &&
        counts.get(role) === 1 &&
        ['background', 'design notes'].includes(role);
      h.element.tabIndex = -1;
      for (const [unitIndex, unit] of this.units.entries()) {
        if (!unit.element.id) unit.element.id = `${this.id}-unit-${unitIndex}`;
      }
      h.controls = this.units
        .filter(
          (unit) =>
            unit.owner >= index && unit.owner < h.end && !(unit.owner === index && unit.heading),
        )
        .map((unit) => unit.element.id)
        .join(' ');
    }
    // Ambiguous nested markup remains visible rather than inferring ranges from prose.
    if (!safe) this.units = this.units.map((unit) => ({ ...unit, owner: -1 }));
    this.canFocus.set(safe);
    if (!safe) this.focused.set(null);
    this.headings.set(enabled ? headings : []);
    if (reset) {
      this.collapsed.set(new Set(headings.flatMap((h, i) => (h.collapsible ? [i] : []))));
      this.focused.set(null);
      this.active.set(null);
    } else
      this.collapsed.set(new Set([...this.collapsed()].filter((i) => headings[i]?.collapsible)));
    for (const unit of this.units) {
      const owner = headings[unit.owner],
        role = owner ? normalized(owner.title) : '';
      if (enabled && typed && safe && roles.has(role))
        unit.element.setAttribute('data-reader-role', role);
      else unit.element.removeAttribute('data-reader-role');
    }
    this.apply();
  }
  private within(index: number, ancestor: number) {
    return index >= ancestor && index < this.headings()[ancestor].end;
  }
  private apply() {
    const hidden = (owner: number, heading: boolean) => {
      const focus = this.focused();
      if (focus !== null && !this.within(owner, focus)) return true;
      return [...this.collapsed()].some(
        (index) => this.within(owner, index) && (owner !== index || !heading),
      );
    };
    for (const unit of this.units) unit.element.hidden = hidden(unit.owner, unit.heading);
    for (const wrapper of this.wrappers) wrapper.element.hidden = hidden(wrapper.owner, true);
  }
  toggle(index: number) {
    if (!this.headings()[index]?.collapsible) return;
    this.collapsed.update((value) => {
      const next = new Set(value);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    this.apply();
  }
  expandAll() {
    this.collapsed.set(new Set());
    this.focused.set(null);
    this.apply();
  }
  showFull() {
    this.focused.set(null);
    this.apply();
  }
  focus(index: number) {
    if (!this.canFocus()) return;
    this.focused.set(index);
    this.reveal(index);
    this.go(index);
  }
  reveal(index: number) {
    const focus = this.focused();
    if (focus !== null && !this.within(index, focus)) this.focused.set(null);
    this.collapsed.update(
      (value) => new Set([...value].filter((ancestor) => !this.within(index, ancestor))),
    );
    this.active.set(index);
    this.apply();
  }
  go(index: number) {
    const heading = this.headings()[index];
    if (!heading) return;
    this.reveal(index);
    heading.element.scrollIntoView({ block: 'start' });
    heading.element.focus({ preventScroll: true });
  }
  revealElement(target: HTMLElement) {
    const index = this.headings().findIndex(
      (h) => h.element === target || h.element.contains(target),
    );
    const unit = this.units.find((u) => u.element === target || u.element.contains(target));
    const wrapper = this.wrappers.find((w) => w.element === target);
    const owner = index >= 0 ? index : (unit?.owner ?? wrapper?.owner ?? -1);
    if (owner >= 0) this.reveal(owner);
    else {
      this.focused.set(null);
      this.collapsed.set(new Set());
      this.apply();
    }
  }
}
