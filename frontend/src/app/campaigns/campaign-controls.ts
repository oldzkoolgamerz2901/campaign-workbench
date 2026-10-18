import { Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { LibraryState } from './library-state';

@Component({
  selector: 'campaign-controls',
  imports: [FormsModule, MatButtonModule],
  templateUrl: './campaign-controls.html',
  styleUrl: './campaign-controls.css',
})
export class CampaignControls {
  readonly state = inject(LibraryState);
  readonly ready = input(true);
  readonly close = output<void>();
  name = '';
  directory = '';
  includes = '';
  excludes = '';
  editingRules = false;
  constructor() {
    let selectedId: string | undefined;
    effect(() => {
      const id = this.state.selected()?.id;
      if (id !== selectedId) {
        this.editingRules = false;
        selectedId = id;
      }
    });
  }
  editRules() {
    const campaign = this.state.selected();
    if (!campaign || !this.ready()) return;
    this.includes = campaign.includes.join('\n');
    this.excludes = campaign.excludes.join('\n');
    this.editingRules = true;
  }
}
