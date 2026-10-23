import { MatButtonModule } from '@angular/material/button';
import {
  Component,
  input,
  output,
  inject,
  ElementRef,
  afterNextRender,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { LibraryEntry } from '../../api/generated';
import { LibraryReferences } from '../campaigns/library-references';
import { UnifiedLibraryState } from '../campaigns/unified-library-state';
import { REFERENCE_LIBRARY_STATE } from '../campaigns/library-references-state';
@Component({
  selector: 'preparation-library',
  imports: [LibraryReferences, MatButtonModule],
  providers: [{ provide: REFERENCE_LIBRARY_STATE, useClass: UnifiedLibraryState }],
  host: { role: 'region', 'aria-label': 'Session Library' },
  styles: `
    :host {
      position: absolute;
      z-index: 8;
      top: 110px;
      right: 20px;
      width: min(660px, calc(100% - 40px));
      max-height: 75dvh;
      overflow: auto;
      box-sizing: border-box;
      padding: 1rem;
      background: #20372a;
      border: 1px solid #aa9567;
      box-shadow: 0 6px 24px #0008;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }
  `,
  template: `<header>
      <h3>Add cards from Library · {{ title() }}</h3>
      <button matButton (click)="close.emit()">Close session Library</button>
    </header>
    <library-references
      [campaign]="campaign()"
      [session]="session()"
      [allowAdd]="true"
      [busy]="busy()"
      (openDocument)="openDocument.emit($event)"
      (prepared)="prepared.emit($event)"
      (added)="added.emit($event)"
    />`,
})
export class PreparationLibrary implements OnDestroy {
  private readonly state = inject(REFERENCE_LIBRARY_STATE);
  detach() {
    this.state.detach();
  }
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly opener =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLButtonElement>('header button')?.focus(),
    );
  }
  @HostListener('keydown.escape', ['$event']) escape(event: Event) {
    event.stopPropagation();
    this.close.emit();
  }
  ngOnDestroy() {
    if (this.host.nativeElement.contains(document.activeElement) && this.opener?.isConnected)
      this.opener.focus();
  }
  readonly title = input('');
  readonly busy = input(false);
  readonly close = output<void>();
  readonly campaign = input.required<string>();
  readonly session = input.required<string>();
  readonly openDocument = output<LibraryEntry>();
  readonly prepared = output<string>();
  readonly added = output<{ campaign: string; session: string }>();
}
