import { Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { SourceClassification, SourceDocument, SourceRelationship } from '../../api/generated';
import { LibraryFiltersControl } from './library-filters';
import { ReaderPresentation } from '../shared/reader/reader-presentation';
import { ReaderControls } from '../shared/reader/reader-controls';
import { LibraryState } from './library-state';

@Component({
  selector: 'campaign-library',
  imports: [MatButtonModule, LibraryFiltersControl, ReaderPresentation, ReaderControls],
  templateUrl: './library.html',
  styleUrl: './library.css',
})
export class CampaignLibrary {
  readonly state = inject(LibraryState);
  readonly ready = input(true);
  readonly shelfVisible = input(true);
  readonly readerVisible = input(true);
  readonly canAdd = input(false);
  readonly authoring = input(false);
  readonly copySource = output<{ capture: string; path: string }>();
  readonly addSource = output<{ path: string; section: string | null }>();
  readonly requestSession = output<void>();
  readonly openSource = output<void>();
  get query() {
    return this.state.query();
  }
  knownNonSession(classification?: SourceClassification) {
    return ['guidance', 'tooling'].includes(classification?.metadata?.purpose ?? '');
  }
  eligible(document: SourceDocument) {
    return !this.knownNonSession(document.classification);
  }
  related(link: SourceRelationship) {
    const target = link.target;
    if (this.ready() && target?.external && !target.missing)
      window.open(target.external, '_blank', 'noopener,noreferrer');
    else if (this.ready() && target?.document && !target.missing)
      this.open(target.document, target.section);
  }
  follow(event: MouseEvent) {
    if (this.ready()) this.state.follow(event);
    else if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
  }
  open(path: string, section?: string | null, block?: string | null) {
    if (!this.ready()) return;
    this.openSource.emit();
    void this.state.open(path, section, block);
  }
  readonly assemble = output<SourceDocument>();
}
