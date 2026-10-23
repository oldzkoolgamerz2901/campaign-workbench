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
import { LibraryState } from '../campaigns/library-state';
import { SessionState } from './session-state';
import { CampaignControls } from '../campaigns/campaign-controls';
import { SessionContents } from './session-contents';
import { revealReaderTarget } from '../shared/reader/reader-presentation';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { CardTable } from './card-table';
import { FocusedTabletop } from '../playthroughs/focused-tabletop';
import { WorkbenchHeader, WorkbenchMode } from '../shared/workbench-header/workbench-header';
import { PreparationLibrary } from './preparation-library';
import { ScenePlanning } from './scene-planning';
import { MarkdownView } from './markdown-view';

@Component({
  selector: 'preparation-workspace',
  imports: [
    FormsModule,
    MatButtonModule,
    MatMenuModule,
    MarkdownView,
    ScenePlanning,
    PreparationLibrary,
    CampaignControls,
    SessionContents,
    PlayingCard,
    CardTable,
    FocusedTabletop,
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
    const ids = new Set(this.state.play.current()?.active ?? []);
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
  readonly saveStatus = computed(() => {
    const statuses = [this.state.status(), this.state.play.status()];
    return statuses.includes('failed')
      ? 'failed'
      : statuses.includes('saving')
        ? 'saving'
        : statuses.includes('pending')
          ? 'pending'
          : 'saved';
  });
  readonly saveLabel = computed(() =>
    this.state.play.loading()
      ? 'Opening Play workspace…'
      : this.saveStatus() === 'saved'
        ? 'Saved'
        : this.saveStatus() === 'failed'
          ? 'Save failed'
          : this.saveStatus() === 'saving'
            ? 'Saving…'
            : 'Unsaved changes',
  );
  private pendingPlay = false;
  readonly sessionDetailsOpen = signal(false);
  readonly cardOpen = signal(false);
  readonly planning = signal(false);
  readonly unifiedLibraryOpen = signal(false);
  readonly libraryDestination = signal<{ campaign: string; session: string; title: string } | null>(
    null,
  );
  private pendingLibraryCampaign: string | null = null;
  private readonly prepareLibrary = viewChild(PreparationLibrary);
  closePrepareLibrary() {
    this.prepareLibrary()?.detach();
    this.unifiedLibraryOpen.set(false);
    this.libraryDestination.set(null);
  }
  openPrepareLibrary() {
    if (!this.campaignReady() || this.busy() || this.state.loading()) return;
    const session = this.state.current();
    if (!session) {
      this.pendingLibraryCampaign = this.library.selected()?.id ?? null;
      this.sessionsOpen.set(true);
      return;
    }
    this.libraryDestination.set({
      campaign: session.campaign,
      session: session.id,
      title: session.title,
    });
    this.unifiedLibraryOpen.set(true);
  }
  async refreshPreparedLibrary(destination: { campaign: string; session: string }) {
    const epoch = this.routeEpoch,
      pin = this.libraryDestination();
    const active = () =>
      epoch === this.routeEpoch &&
      this.unifiedLibraryOpen() &&
      this.libraryDestination() === pin &&
      pin?.campaign === destination.campaign &&
      pin?.session === destination.session &&
      this.state.current()?.campaign === destination.campaign &&
      this.state.current()?.id === destination.session;
    if (!active() || !(await this.state.flush()) || !active()) return false;
    const selected = this.state.selectedItem(),
      intent = this.readerIntent;
    if (!(await this.state.open(destination.campaign, destination.session, true)) || !active())
      return false;
    if (
      intent === this.readerIntent &&
      selected &&
      this.state.current()?.items.some((i) => i.id === selected)
    )
      this.state.selectItem(selected);
    return true;
  }
  async openLibraryPrepared(id: string) {
    const destination = this.libraryDestination();
    if (!destination || this.state.loading()) return;
    if (!(await this.refreshPreparedLibrary(destination))) return;
    this.closePrepareLibrary();
    this.selectPrepared(id);
  }
  readLibraryReference(key: string | undefined) {
    if (key)
      void this.router.navigate(['/library'], {
        queryParams: {
          campaign: this.state.current()?.campaign,
          session: this.state.current()?.id,
          reference: key,
        },
      });
  }
  private sceneScroll = 0;
  readonly inspectedScene = signal<string | null>(null);
  readonly isScene = computed(
    () =>
      this.item()?.capturedSource?.classification?.metadata?.type === 'scene' &&
      !this.item()?.capturedSource?.classification?.issues?.some((i) => i.severity === 'error'),
  );
  inspectSceneCard(id: string) {
    if (this.busy()) return;
    this.sceneScroll = document.querySelector('.source-page')?.scrollTop ?? 0;
    this.inspectedScene.set(this.item()!.id);
    this.planning.set(false);
    this.cardOpen.set(false);
    this.selectReader(id);
  }
  backToScene() {
    const scene = this.inspectedScene();
    if (!scene || !this.state.current()?.items.some((i) => i.id === scene)) {
      this.inspectedScene.set(null);
      return;
    }
    this.selectReader(scene);
    this.inspectedScene.set(null);
    this.planning.set(true);
    requestAnimationFrame(() => {
      const reader = document.querySelector('.source-page');
      if (reader) reader.scrollTop = this.sceneScroll;
    });
  }
  readonly library = inject(LibraryState);
  readonly state = inject(SessionState);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly busy = computed(
    () =>
      this.state.transferBusy() ||
      this.state.mutating() ||
      this.state.checkingRemoval() ||
      this.state.queueRunning(),
  );
  readonly reading = signal(false);
  readonly campaignReady = signal(false);
  readonly sessionsOpen = signal(false);
  readonly managementOpen = signal(false);
  readonly contentsOpen = signal(true);
  readonly notesOpen = signal(true);
  readonly notesScope = signal<'session' | 'item'>('session');
  readonly item = computed(
    () => this.state.current()?.items.find((i) => i.id === this.state.selectedItem()) ?? null,
  );
  readonly hasTabletop = computed(
    () =>
      !!this.state.play.current()?.focusedItemIds.length || !!this.state.play.inspectionItemId(),
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
  private readerIntent = 0;
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
      const destination = this.libraryDestination();
      if (
        destination &&
        (destination.campaign !== campaign ||
          destination.session !== id ||
          ['read', 'play'].includes(params.get('mode') ?? ''))
      )
        this.closePrepareLibrary();
      if (this.pendingLibraryCampaign && this.pendingLibraryCampaign !== campaign)
        this.pendingLibraryCampaign = null;
      const applyView = () => {
        const item = params.get('item');
        if (item && this.state.current()?.items.some((i) => i.id === item))
          this.state.selectItem(item);
        this.reading.set(['read', 'play'].includes(params.get('mode') ?? '') && !!id);
        if (!id && ['read', 'play'].includes(params.get('mode') ?? '')) this.pendingPlay = true;
        if (this.reading()) void this.openPlayContext();
        if (id && this.campaignReady() && this.pendingLibraryCampaign === campaign) {
          this.pendingLibraryCampaign = null;
          this.openPrepareLibrary();
        }
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
      this.planning.set(false);
      this.inspectedScene.set(null);
      this.cardOpen.set(false);
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
        if (id && this.pendingLibraryCampaign === campaign) {
          this.pendingLibraryCampaign = null;
          this.openPrepareLibrary();
        }
      })();
    });
  }
  ngOnDestroy() {
    this.routeEpoch++;
    this.closePrepareLibrary();
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
    if (mode === 'prepare') {
      this.planning.set(false);
      this.inspectedScene.set(null);
    }
    if (mode === 'library') {
      void this.router.navigate(['/library'], { queryParams: this.route.snapshot.queryParams });
      return;
    }
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
  async recoverPreparation(action: 'retry' | 'reload') {
    const session = this.state.current(),
      epoch = this.routeEpoch;
    if (!session) return;
    const recovered = action === 'retry' ? await this.state.flush() : await this.state.reload();
    if (
      recovered &&
      epoch === this.routeEpoch &&
      this.reading() &&
      this.state.current()?.campaign === session.campaign &&
      this.state.current()?.id === session.id &&
      !this.state.play.hasUnsaved()
    ) {
      await this.openPlayContext();
    }
  }
  private async openPlayContext() {
    const session = this.state.current(),
      epoch = this.routeEpoch,
      readerIntent = this.readerIntent;
    if (!session) return;
    await this.state.initializeTable();
    if (
      epoch !== this.routeEpoch ||
      !this.reading() ||
      this.state.current()?.campaign !== session.campaign ||
      this.state.current()?.id !== session.id
    )
      return;
    // Frozen reader links remain usable while the workspace opens. Reconcile
    // newer explicit reading intent instead of restoring over it.
    if (readerIntent !== this.readerIntent) {
      const selected = this.state.selectedItem();
      if (selected && this.state.play.current() && !this.state.play.loading()) {
        if (
          this.state.play.expandedItemId() &&
          this.state.play.current()?.focusedItemIds.includes(selected)
        )
          this.state.play.expand(selected);
        else this.state.play.inspect(selected);
      }
      return;
    }
    const expanded = this.state.play.expandedItemId();
    if (expanded) this.state.selectItem(expanded);
  }
  private selectReader(id: string) {
    this.readerIntent++;
    this.state.selectItem(id);
  }
  async create() {
    const campaign = this.library.selected();
    if (!campaign) return;
    const s = await this.state.create(campaign.id, this.title, this.objective);
    if (s) {
      this.pendingPlay = false;
      this.title = '';
      this.objective = '';
      await this.navigate(s.id, 'library', 'prepare');
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
    this.planning.set(false);
    this.inspectedScene.set(null);
    this.cardOpen.set(false);
    this.selectReader(id);
    if (this.reading()) {
      if (
        this.state.play.expandedItemId() &&
        this.state.play.current()?.focusedItemIds.includes(id)
      )
        this.state.play.expand(id);
      else this.state.play.inspect(id);
    }
    void this.navigate(undefined, 'prepare');
  }
  focusPrepared(id: string) {
    if (this.busy() || !this.reading()) return;
    this.state.play.focus(id);
    const epoch = this.routeEpoch;
    setTimeout(() => {
      if (
        epoch !== this.routeEpoch ||
        !this.reading() ||
        !this.state.play.current()?.focusedItemIds.includes(id)
      )
        return;
      const stage = document.querySelector<HTMLElement>('play-tabletop > section');
      if (stage) {
        stage.tabIndex = -1;
        stage.focus({ preventScroll: true });
        stage.scrollIntoView({ block: 'nearest' });
      }
    });
  }
  expandPrepared(id: string) {
    if (this.busy() || !this.reading()) return;
    this.state.play.expand(id);
    if (this.state.play.expandedItemId() === id) this.openPreparedDocument(id, false);
  }
  openPreparedDocument(id: string, inspect = true) {
    if (this.busy()) return;
    if (inspect) this.selectPrepared(id);
    else this.selectReader(id);
    const epoch = this.routeEpoch;
    setTimeout(() => {
      if (epoch !== this.routeEpoch || this.state.selectedItem() !== id || !this.reading()) return;
      const reader = document.querySelector<HTMLElement>('.source-page');
      if (reader) {
        reader.tabIndex = 0;
        reader.scrollIntoView({ block: 'nearest' });
        reader.focus({ preventScroll: true });
      }
    });
  }
  closeInspection() {
    const id = this.state.play.inspectionItemId();
    this.state.play.inspectionItemId.set(null);
    const expanded = this.state.play.expandedItemId();
    if (expanded) this.selectReader(expanded);
    const epoch = this.routeEpoch;
    setTimeout(() => {
      if (epoch !== this.routeEpoch || !this.reading()) return;
      const cards = document.querySelectorAll<HTMLElement>('read-card-table [data-item-id]');
      Array.from(cards)
        .find((node) => node.dataset['itemId'] === id)
        ?.querySelector<HTMLElement>('article')
        ?.focus();
    });
  }
  cancelSessionChooser() {
    this.pendingLibraryCampaign = null;
    this.sessionsOpen.set(false);
  }
  sessionNotes() {
    this.notesScope.set('session');
    this.notesOpen.set(true);
  }
  @HostListener('window:keydown.escape') closePanels() {
    this.sessionsOpen.set(false);
    this.pendingLibraryCampaign = null;
    this.closePrepareLibrary();
    this.managementOpen.set(false);
    this.sessionDetailsOpen.set(false);
    this.pendingPlay = false;
    if (this.reading()) this.closeInspection();
  }
  followCaptured(target: string) {
    const [id, anchor] = target.slice(1).split('#');
    if (!this.state.current()?.items.some((i) => i.id === id)) return;
    this.selectReader(id);
    if (this.reading()) {
      if (
        this.state.play.expandedItemId() &&
        this.state.play.current()?.focusedItemIds.includes(id)
      )
        this.state.play.expand(id);
      else this.state.play.inspect(id);
    }
    this.cardOpen.set(false);
    const epoch = this.routeEpoch;
    setTimeout(() => {
      if (epoch !== this.routeEpoch || this.state.selectedItem() !== id) return;
      const page = document.querySelector('.source-page');
      const index = this.source()?.anchors.indexOf(anchor) ?? -1;
      const node = anchor
        ? page?.querySelectorAll(
            'prepared-markdown h1,prepared-markdown h2,prepared-markdown h3,prepared-markdown h4,prepared-markdown h5,prepared-markdown h6',
          )[index]
        : page;
      if (node instanceof HTMLElement) {
        revealReaderTarget(node);
        node.tabIndex = node === page ? 0 : -1;
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
  private panelsBeforeFocus = { contents: true, notes: true };
  toggleSourceFocus() {
    this.focusSource = !this.focusSource;
    if (this.focusSource) {
      this.panelsBeforeFocus = {
        contents: this.contentsOpen(),
        notes: this.notesOpen(),
      };
      this.contentsOpen.set(false);
      this.notesOpen.set(false);
    } else {
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
