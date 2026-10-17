import { Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { LibraryState } from './library-state';

@Component({
  selector: 'campaign-library', imports: [FormsModule, MatButtonModule],
  templateUrl: './library.html', styleUrl: './library.css',
})
export class CampaignLibrary {
  readonly state = inject(LibraryState);
  readonly addSource = output<{path: string; section: string | null}>();
  name = ''; directory = ''; query = '';
  includes = ''; excludes = ''; editingRules = false;
  constructor() { void this.state.initialize(); }
  editRules() {
    const campaign = this.state.selected(); if (!campaign) return;
    this.includes = campaign.includes.join('\n'); this.excludes = campaign.excludes.join('\n'); this.editingRules = true;
  }
  select(id: string) { this.editingRules = false; this.query = ''; void this.state.select(id); }
}
