import { PreparedArtwork } from '../preparation/artwork-sources';
import {
  Component,
  HostListener,
  computed,
  inject,
  signal,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { CampaignLibrary } from '../campaigns/library';
import { LibraryState } from '../campaigns/library-state';
import { SessionState } from './session-state';
import { CampaignControls } from '../campaigns/campaign-controls';
import { SessionContents } from './session-contents';
import { SourceDocument } from '../../api/generated';
import { AdventureAssembly } from './adventure-assembly';
import { revealReaderTarget } from '../shared/reader/reader-presentation';
import { DraftChooser } from './draft-chooser';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { DraftData } from '../../api/generated';
import { CardTable } from './card-table';
import { WorkbenchHeader, WorkbenchMode } from '../shared/workbench-header/workbench-header';
import { MarkdownView } from './markdown-view';

@Component({
  selector: 'preparation-workspace',
  imports: [
    FormsModule,
    MatButtonModule,
    MatMenuModule,
    CampaignLibrary,
    MarkdownView,
    CampaignControls,
    SessionContents,
    AdventureAssembly,
    DraftChooser,
    PlayingCard,
    CardTable,
    WorkbenchHeader,
  ],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class Workspace implements OnDestroy {
  readonly artwork = inject(PreparedArtwork);
  readonly cardQuery = signal('');
  readonly cardGroup = signal('');
  readonly cardTypes = [
    'npc',
    'location',
    'faction',
    'item',
    'scene',
    'adventure',
    'handout',
    'reference',
  ];
  readonly activeCount = computed(() => {
    const ids = new Set(this.state.current()?.table?.active ?? []);
    const query = this.cardQuery().trim().toLowerCase();
    return (
      this.state
        .current()
        ?.items.filter(
          (i) =>
            ids.has(i.id) &&
            (!this.cardGroup() ||
              i.capturedSource?.classification?.metadata?.type === this.cardGroup()) &&
            `${i.title} ${i.provenance.path}`.toLowerCase().includes(query),
        ).length ?? 0
    );
  });
  readonly saveLabel = computed(() =>
    this.state.status() === 'saved'
      ? 'Saved'
      : this.state.status() === 'failed'
        ? 'Save failed'
        : this.state.status() === 'saving'
          ? 'Saving…'
          : 'Unsaved changes',
  );
  private pendingPlay = false;
  readonly sessionDetailsOpen = signal(false);
  readonly material = signal<'sources' | 'drafts'>('sources');
  readonly cardOpen = signal(false);
  readonly library = inject(LibraryState);
  readonly state = inject(SessionState);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly adventure = signal<SourceDocument | null>(null);
  readonly busy = computed(
    () => this.state.transferBusy() || this.state.mutating() || this.state.queueRunning(),
  );
  readonly reading = signal(false);
  readonly showingLibrary = signal(true);
  readonly campaignReady = signal(false);
  readonly sessionsOpen = signal(false);
  readonly managementOpen = signal(false);
  readonly libraryOpen = signal(true);
  readonly contentsOpen = signal(true);
  readonly notesOpen = signal(true);
  readonly notesScope = signal<'session' | 'item'>('session');
  readonly libraryVisible = computed(() => this.libraryOpen() && !this.reading());
  readonly item = computed(
    () => this.state.current()?.items.find((i) => i.id === this.state.selectedItem()) ?? null,
  );
  readonly sourceReader = viewChild<MarkdownView>('sourceReader');
  readonly source = computed(
    () => this.state.rendered()?.items.find((i) => i.id === this.item()?.id)?.source ?? null,
  );
  readonly sourceHasTitle = computed(() => {
    const html = this.source()?.html;
    if (!html || !this.item()) return false;
    const heading = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('h1, h2, h3, h4, h5, h6');
    return heading?.textContent?.trim() === this.item()?.title.trim();
  });
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
    if (!this.library.campaigns().length) this.managementOpen.set(true);
    this.applyingRoute = false;
    this.subscription = this.route.queryParamMap.subscribe((params) => {
      const epoch = ++this.routeEpoch;
      const campaign = params.get('campaign') ?? this.library.selected()?.id;
      const id = params.get('session');
      const applyView = () => {
        this.reading.set(['read', 'play'].includes(params.get('mode') ?? '') && !!id);
        if (!id && ['read', 'play'].includes(params.get('mode') ?? '')) this.pendingPlay = true;
        if (this.reading()) this.state.initializeTable();
        this.showingLibrary.set(params.get('view') === 'library' || !id);
      };
      // A view change keeps the working session and all pending edits in place.
      if (
        this.campaignReady() &&
        campaign === this.library.selected()?.id &&
        id === this.state.current()?.id
      ) {
        applyView();
        return;
      }
      this.campaignReady.set(false);
      void (async () => {
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
        if (campaign && id) await this.state.open(campaign, id);
        else if (this.state.current()) this.state.clear();
        if (epoch !== this.routeEpoch) return;
        if (campaign) await this.state.list(campaign);
        if (epoch !== this.routeEpoch) return;
        applyView();
        this.cardQuery.set('');
        this.cardGroup.set('');
        this.notesScope.set(this.state.current()?.items.length ? 'item' : 'session');
        this.sessionsOpen.set(this.pendingPlay && !id);
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
  navigate(session?: string | null, view = 'prepare', mode = this.reading() ? 'play' : 'prepare') {
    if (this.busy()) return Promise.resolve(false);
    this.adventure.set(null);
    return this.router.navigate([], {
      queryParams: {
        campaign: this.library.selected()?.id,
        session: session ?? this.state.current()?.id ?? null,
        view,
        mode,
      },
    });
  }
  changeMode(mode: WorkbenchMode) {
    if (mode !== 'play') this.pendingPlay = false;
    if (mode === 'write') {
      this.openWriting();
      return;
    }
    if (mode === 'play' && !this.state.current()) {
      this.pendingPlay = true;
      this.sessionsOpen.set(true);
      return;
    }
    void this.navigate(undefined, this.state.current() ? 'prepare' : 'library', mode);
  }
  async create() {
    const campaign = this.library.selected();
    if (!campaign) return;
    const s = await this.state.create(campaign.id, this.title, this.objective);
    if (s) {
      this.pendingPlay = false;
      this.title = '';
      this.objective = '';
      this.libraryOpen.set(true);
      await this.navigate(s.id, 'library', 'prepare');
    }
  }
  async add(selection: { path: string; section: string | null }) {
    const lib = this.library.library();
    if (!this.state.current()) {
      this.state.error.set('Create or open a session before adding source material.');
      return;
    }
    if (
      !this.campaignReady() ||
      this.busy() ||
      !lib?.capture ||
      lib.campaign !== this.state.current()?.campaign
    )
      return;
    const added = await this.state.add(lib.capture, selection.path, selection.section);
    if (added) {
      this.notesScope.set('item');
      this.contentsOpen.set(true);
    }
  }
  async approveDraft(draft: DraftData) {
    if (!this.campaignReady() || this.busy() || draft.campaign !== this.state.current()?.campaign)
      return;
    if (await this.state.addDraft(draft.id, draft.revision)) {
      this.notesScope.set('item');
      this.contentsOpen.set(true);
      this.cardOpen.set(false);
      await this.navigate(undefined, 'prepare');
    }
  }
  async openSession(id: string) {
    await this.navigate(id, 'prepare', this.pendingPlay ? 'play' : 'prepare');
    this.pendingPlay = false;
    this.sessionsOpen.set(false);
  }
  selectCampaign(id: string) {
    if (this.campaignReady() && !this.busy()) void this.library.select(id);
  }
  openWriting() {
    void this.router.navigate(['/writing'], { queryParams: this.route.snapshot.queryParams });
  }
  selectPrepared(id: string) {
    if (this.busy()) return;
    this.cardOpen.set(false);
    this.state.selectItem(id);
    this.notesScope.set('item');
    void this.navigate(undefined, 'prepare');
  }
  browse() {
    this.material.set('sources');
    this.libraryOpen.set(true);
    void this.navigate(undefined, 'library', 'prepare');
  }
  sessionNotes() {
    this.notesScope.set('session');
    this.notesOpen.set(true);
  }
  @HostListener('window:keydown.escape') closePanels() {
    this.sessionsOpen.set(false);
    this.managementOpen.set(false);
    this.sessionDetailsOpen.set(false);
    this.pendingPlay = false;
  }
  followCaptured(target: string) {
    const [id, anchor] = target.slice(1).split('#');
    if (!this.state.current()?.items.some((i) => i.id === id)) return;
    this.state.selectItem(id);
    this.cardOpen.set(false);
    this.notesScope.set('item');
    setTimeout(() => {
      const page = document.querySelector('.source-page');
      const index = this.source()?.anchors.indexOf(anchor) ?? -1;
      const node = anchor
        ? page?.querySelectorAll(
            'prepared-markdown h1,prepared-markdown h2,prepared-markdown h3,prepared-markdown h4,prepared-markdown h5,prepared-markdown h6',
          )[index]
        : page;
      if (node instanceof HTMLElement) {
        revealReaderTarget(node);
        node.tabIndex = -1;
        node.scrollIntoView({ block: 'center' });
        node.focus({ preventScroll: true });
      }
    });
  }
  private renderedRelationship(index: number) {
    // Captured relationships and rendered links retain source traversal order, but use separate keys.
    const relationships = this.item()?.capturedSource?.relationships ?? [];
    const links = this.source()?.links ?? [];
    return relationships.length === links.length ? links[index] : undefined;
  }
  capturedAvailable(index: number) {
    const link = this.renderedRelationship(index);
    return !!link && !link.unavailable && !!(link.target || link.external);
  }
  capturedRelated(index: number) {
    const link = this.renderedRelationship(index);
    if (link?.external && !link.unavailable)
      window.open(link.external, '_blank', 'noopener,noreferrer');
    else if (link?.target?.startsWith('@') && !link.unavailable) this.followCaptured(link.target);
    else if (link?.target && !link.unavailable) this.sourceReader()?.revealAnchor(link.target);
    else this.state.error.set('This relationship is outside the captured material.');
  }
  focusSource = false;
  private panelsBeforeFocus = { library: true, contents: true, notes: true };
  toggleSourceFocus() {
    this.focusSource = !this.focusSource;
    if (this.focusSource) {
      this.panelsBeforeFocus = {
        library: this.libraryOpen(),
        contents: this.contentsOpen(),
        notes: this.notesOpen(),
      };
      this.libraryOpen.set(false);
      this.contentsOpen.set(false);
      this.notesOpen.set(false);
    } else {
      this.libraryOpen.set(this.panelsBeforeFocus.library);
      this.contentsOpen.set(this.panelsBeforeFocus.contents);
      this.notesOpen.set(this.panelsBeforeFocus.notes);
    }
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
