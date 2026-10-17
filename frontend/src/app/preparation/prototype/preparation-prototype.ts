import { Component, HostListener, computed, inject, isDevMode } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { VariantA, VariantB, VariantC } from './variants';
import { PrototypeState } from './prototype-state';

// Question: which atmospheric layout best supports finding, ordering, reading and annotating session material?
// Three disposable variants on the existing root, gated by ?prototype=preparation&variant=A|B|C.
@Component({
  selector: 'preparation-prototype', imports: [VariantA, VariantB, VariantC], providers: [PrototypeState],
  styleUrl: './prototype-host.css',
  template: `
    @if (development) {
      <div class="study-banner"><span>DESIGN STUDY / 02</span><span>Sample campaign · changes stay in this page</span><a href="/">Return to the application ↗</a></div>
      @switch (variant()) {
        @case ('B') { <preparation-variant-b /> }
        @case ('C') { <preparation-variant-c /> }
        @default { <preparation-variant-a /> }
      }
      <div class="study-tools">
        <div class="study-state">{{ s.items().length }} prepared items · {{ s.selected()?.title }} · {{ s.saveState() }}</div>
        <nav class="switcher" aria-label="Design variants">
          <button (click)="cycle(-1)" aria-label="Previous design">←</button>
          <div><span>LAYOUT {{ variant() }} / 3</span><strong>{{ names[variant()] }}</strong></div>
          <button (click)="cycle(1)" aria-label="Next design">→</button>
        </nav>
        <label class="failure"><input type="checkbox" [checked]="s.failSaves()" (change)="s.failSaves.set(!s.failSaves()); s.save()"> Simulate save failure</label>
      </div>
      @if (s.notice()) { <div class="study-notice" role="status">{{ s.notice() }} <button (click)="s.notice.set('')" aria-label="Dismiss notice">×</button></div> }
    }
  `,
})
export class PreparationPrototype {
  readonly development = isDevMode();
  readonly s = inject(PrototypeState);
  readonly names = { A: 'The writing desk', B: 'The session folio', C: 'The scene board' };
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly variant = computed<'A' | 'B' | 'C'>(() => { const value = this.params().get('variant'); return value === 'B' || value === 'C' ? value : 'A'; });
  cycle(offset: number) {
    const variants = ['A', 'B', 'C'];
    void this.router.navigate([], { queryParams: { prototype: 'preparation', variant: variants[(variants.indexOf(this.variant()) + offset + 3) % 3] }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  @HostListener('window:keydown', ['$event']) key(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('input,textarea,select,[contenteditable="true"]') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); this.cycle(event.key === 'ArrowRight' ? 1 : -1); }
  }
}
