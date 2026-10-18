import { Component, HostListener, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { CampaignLibrary } from '../campaigns/library';
import { LibraryState } from '../campaigns/library-state';
import { SessionState } from './session-state';
import { MarkdownView } from './markdown-view';

@Component({
  selector: 'preparation-workspace',
  imports: [FormsModule, MatButtonModule, CampaignLibrary, MarkdownView],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class Workspace implements OnDestroy {
  readonly library = inject(LibraryState);
  readonly state = inject(SessionState);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly reading = signal(false);
  readonly showingLibrary = signal(true);
  readonly campaignReady = signal(false);
  readonly item = computed(
    () => this.state.current()?.items.find((i) => i.id === this.state.selectedItem()) ?? null,
  );
  readonly source = computed(
    () => this.state.rendered()?.items.find((i) => i.id === this.item()?.id)?.source ?? null,
  );
  title = '';
  objective = '';
  exportIds: string[] = [];
  private applyingRoute = true;
  private subscription?: Subscription;
  private routeEpoch = 0;
  constructor() {
    void this.initialize();
  }
  private async initialize() {
    this.library.beforeSelect = async (id) => {
      if (this.applyingRoute || id === this.library.selected()?.id) return true;
      await this.router.navigate([], { queryParams: { campaign: id, view: 'library' } });
      return false;
    };
    await this.library.initialize();
    this.applyingRoute = false;
    this.subscription = this.route.queryParamMap.subscribe((params) => {
      const epoch = ++this.routeEpoch;
      this.campaignReady.set(false);
      void (async () => {
        const campaign = params.get('campaign') ?? this.library.selected()?.id;
        if (campaign && campaign !== this.library.selected()?.id) {
          this.exportIds = [];
          this.applyingRoute = true;
          try {
            await this.library.select(campaign);
          } finally {
            this.applyingRoute = false;
          }
        }
        if (epoch !== this.routeEpoch) return;
        if (campaign) this.state.bindCampaign(campaign);
        const id = params.get('session');
        if (campaign && id) await this.state.open(campaign, id);
        else if (this.state.current()) this.state.clear();
        if (epoch !== this.routeEpoch) return;
        if (campaign) await this.state.list(campaign);
        if (epoch !== this.routeEpoch) return;
        this.reading.set(params.get('mode') === 'read');
        this.showingLibrary.set(params.get('view') === 'library' || !id);
        this.campaignReady.set(!campaign || campaign === this.library.selected()?.id);
      })();
    });
  }
  ngOnDestroy() {
    this.routeEpoch++;
    this.subscription?.unsubscribe();
    this.library.beforeSelect = async () => true;
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.state.hasUnsaved()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  navigate(session?: string | null, view = 'prepare', mode = this.reading() ? 'read' : 'prepare') {
    return this.router.navigate([], {
      queryParams: {
        campaign: this.library.selected()?.id,
        session: session ?? this.state.current()?.id ?? null,
        view,
        mode,
      },
    });
  }
  async create() {
    const campaign = this.library.selected();
    if (!campaign) return;
    const s = await this.state.create(campaign.id, this.title, this.objective);
    if (s) {
      this.title = '';
      this.objective = '';
      await this.navigate(s.id, 'prepare', 'prepare');
    }
  }
  async add(selection: { path: string; section: string | null }) {
    const lib = this.library.library();
    if (!this.state.current()) {
      this.state.error.set('Create or open a session before adding source material.');
      return;
    }
    if (!lib?.capture || lib.campaign !== this.state.current()?.campaign) return;
    await this.state.add(lib.capture, selection.path, selection.section);
    if (!this.state.error()) await this.navigate(undefined, 'prepare', 'prepare');
  }
  followCaptured(target: string) {
    const [id, anchor] = target.slice(1).split('#');
    if (!this.state.current()?.items.some((i) => i.id === id)) return;
    this.state.selectedItem.set(id);
    setTimeout(() => {
      const page = document.querySelector('.source-page');
      const index = this.source()?.anchors.indexOf(anchor) ?? -1;
      const node = anchor
        ? page?.querySelectorAll(
            'prepared-markdown h1,prepared-markdown h2,prepared-markdown h3,prepared-markdown h4,prepared-markdown h5,prepared-markdown h6',
          )[index]
        : page;
      if (node instanceof HTMLElement) {
        node.tabIndex = -1;
        node.scrollIntoView({ block: 'center' });
        node.focus({ preventScroll: true });
      }
    });
  }
  toggleExport(id: string, checked: boolean) {
    this.exportIds = checked ? [...this.exportIds, id] : this.exportIds.filter((i) => i !== id);
  }
  importFile(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0],
      campaign = this.library.selected();
    if (file && campaign && this.campaignReady()) void this.state.import(campaign.id, file);
    input.value = '';
  }
}
