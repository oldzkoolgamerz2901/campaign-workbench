import { ArtworkImage } from '../shared/artwork/artwork-image';
import { WritingArtwork } from '../writing/artwork-sources';
import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { WorkbenchHeader, WorkbenchMode } from '../shared/workbench-header/workbench-header';
import { MatButtonModule } from '@angular/material/button';
import { Subscription, firstValueFrom } from 'rxjs';
import { SourceControllerService, CheckedLink, LibraryEntry } from '../../api/generated';
import { WritingExportPanel } from './writing-export-panel';
import { LibraryState } from '../campaigns/library-state';
import { CampaignControls } from '../campaigns/campaign-controls';
import { CardFitPreview } from '../shared/card-layout/card-fit-preview';
import { CardFitFeedback } from '../shared/card-layout/card-fit-feedback';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { DraftReader } from './draft-reader';
import { LibraryReferences } from '../campaigns/library-references';
import { ResearchContext } from './research-context';
import { REFERENCE_LIBRARY_STATE } from '../campaigns/library-references-state';
import { WritingState } from './writing-state';

@Component({
  selector: 'writing-workspace',
  imports: [
    ArtworkImage,
    FormsModule,
    MatButtonModule,
    MatMenuModule,
    WorkbenchHeader,
    CampaignControls,
    PlayingCard,
    CardFitPreview,
    CardFitFeedback,
    DraftReader,
    WritingExportPanel,
    LibraryReferences,
  ],
  templateUrl: './writing-workspace.html',
  styleUrl: './writing-workspace.css',
})
export class WritingWorkspace implements OnDestroy {
  readonly fitPreviewOpen = signal(false);
  readonly research = inject(ResearchContext);
  readonly references = inject(REFERENCE_LIBRARY_STATE);
  readonly editorTab = this.research.editorTab;
  readonly support = this.research.support;
  readonly artwork = inject(WritingArtwork);
  readonly state = inject(WritingState);
  readonly library = inject(LibraryState);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly ready = signal(false);
  readonly newOpen = signal(false);
  readonly detailsOpen = signal(false);
  readonly exportOpen = signal(false);
  readonly previewOpen = this.research.panelOpen;
  readonly exportPanel = viewChild('exportPanel', { read: ElementRef<HTMLElement> });
  readonly saveLabel = computed(() =>
    this.state.deleteFailed()
      ? 'Deletion unresolved'
      : this.state.status() === 'saved'
        ? 'Saved'
        : this.state.status() === 'saving'
          ? 'Saving…'
          : this.state.status() === 'failed'
            ? 'Save failed'
            : 'Unsaved changes',
  );
  readonly management = signal(false);
  readonly full = this.research.fullPreview;
  readonly sourceNotice = signal('');
  private readonly sourcesApi = inject(SourceControllerService);
  readonly sourceTags = computed(
    () =>
      this.library.library()?.documents.flatMap((d) => d.classification?.metadata?.tags ?? []) ??
      [],
  );
  readonly suggestions = computed(() =>
    [...new Set([...this.state.tags(), ...this.sourceTags()])].sort(),
  );
  newType = 'npc';
  template = true;
  private subscription?: Subscription;
  private active = true;
  private routeToken = 0;
  private researchRequest = 0;
  private readonly selectGuard = async (_id: string) => {
    if (!(await this.state.allowLeave())) return false;
    return true;
  };
  constructor() {
    effect(() => this.state.contextChanged(this.library.library()?.capture));
    void this.initialize();
  }
  async recheckSources() {
    if (this.state.deleting()) return false;
    const campaign = this.state.campaign();
    if (!campaign) return false;
    this.sourceNotice.set('');
    try {
      const index = await firstValueFrom(this.sourcesApi.getLibrary(campaign));
      if (campaign !== this.state.campaign()) return false;
      if (index.capture !== this.library.library()?.capture) this.library.document.set(null);
      this.library.library.set(index);
      this.state.contextChanged(index.capture);
      this.state.recheckPreview();
      return true;
    } catch {
      this.sourceNotice.set(
        'Cannot load the captured source index. Retry when the backend is available.',
      );
      return false;
    }
  }
  async followTarget(link: CheckedLink) {
    const draft = this.state.current(),
      campaign = this.state.campaign(),
      token = this.routeToken,
      request = ++this.researchRequest;
    const current = () =>
      this.active &&
      request === this.researchRequest &&
      token === this.routeToken &&
      this.state.current()?.id === draft?.id &&
      this.state.campaign() === campaign;
    if (!draft || !campaign || this.state.deleting() || !(await this.state.flush()) || !current())
      return;
    await this.references.bind(campaign, '');
    if (!current()) return;
    if (this.state.preview()?.capture !== this.references.capture()) {
      this.sourceNotice.set(
        'Source capture changed. Reload captured index and check the updated preview before opening this link.',
      );
      return;
    }
    const followed = await this.references.follow(link);
    if (!current()) return;
    const entry = this.references.document()?.entry;
    if (
      followed &&
      entry &&
      !this.references.error() &&
      (link.kind === 'draft'
        ? entry.draft === link.draft && entry.revision === link.revision
        : entry.sources?.some((source) => source.path === link.path))
    )
      await this.openReference(entry, link);
    else this.sourceNotice.set(this.references.error() || 'The reference is unavailable.');
  }
  selectEditor(tab: 'document' | 'card') {
    this.editorTab.set(tab);
    if (tab === 'card') this.detailsOpen.set(true);
  }
  async openReference(entry: LibraryEntry, target?: CheckedLink) {
    const request = ++this.researchRequest;
    const draft = this.state.current(),
      campaign = this.state.campaign(),
      token = this.routeToken;
    if (!draft || !campaign) return;
    if (!(await this.state.flush())) {
      this.sourceNotice.set(
        'Save failed. Your edits remain in Write. Retry save before opening the full reference.',
      );
      return;
    }
    if (
      !this.active ||
      request !== this.researchRequest ||
      this.references.selectedEntry()?.key !== entry.key ||
      token !== this.routeToken ||
      this.state.current()?.id !== draft.id
    )
      return;
    const editor = document.querySelector<HTMLTextAreaElement>('.body-editor');
    this.research.returnTo.set({
      campaign,
      draft: draft.id,
      session: this.route.snapshot.queryParamMap.get('session'),
      cursor: editor?.selectionStart ?? 0,
      editorScroll: editor?.scrollTop ?? 0,
      pageScroll: document.querySelector('.draft-editor')?.scrollTop ?? 0,
    });
    this.research.away.set(true);
    const opened = await this.router.navigate(['/library'], {
      queryParams: {
        campaign,
        session: this.route.snapshot.queryParamMap.get('session'),
        reference: entry.key,
        referenceCapture: this.references.documentCapture() ?? this.references.capture() ?? '',
        referenceDraft: entry.draft ?? '',
        referenceRevision: entry.revision ?? null,
        referenceSection: target?.section,
        referenceAnchor: target?.anchor,
      },
    });
    if (!opened) this.research.away.set(false);
  }
  private restoreResearch(draft: string) {
    const saved = this.research.returnTo();
    if (!saved || saved.draft !== draft || saved.campaign !== this.state.campaign()) return;
    this.detailsOpen.set(this.editorTab() === 'card');
    requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLTextAreaElement>('.body-editor');
      if (editor && this.state.current()?.id === draft && this.active) {
        editor.setSelectionRange(saved.cursor, saved.cursor);
        editor.scrollTop = saved.editorScroll;
        const panel = document.querySelector('.draft-editor');
        if (panel) panel.scrollTop = saved.pageScroll;
      }
    });
  }
  private async initialize() {
    await this.library.initialize(false);
    if (!this.active) return;
    this.library.beforeSelect = this.selectGuard;
    if (!this.library.campaigns().length) this.management.set(true);
    this.subscription = this.route.queryParamMap.subscribe((params) => {
      const token = ++this.routeToken;
      const campaign = params.get('campaign') ?? this.library.selected()?.id;
      void this.loadCampaign(campaign, token).then(async () => {
        if (!this.active || token !== this.routeToken) return;
        const saved = this.research.returnTo();
        const returning =
          params.get('research') === 'return' ||
          (this.research.away() &&
            !!saved &&
            saved?.campaign === campaign &&
            (!params.get('draft') || params.get('draft') === saved.draft));
        const draft = params.get('draft') ?? (returning ? saved?.draft : null);
        if (draft && this.state.current()?.id !== draft) await this.state.open(draft);
        if (
          this.active &&
          token === this.routeToken &&
          returning &&
          draft &&
          this.state.current()?.id === draft
        ) {
          this.restoreResearch(draft);
          this.research.away.set(false);
        }
      });
    });
  }
  private async loadCampaign(campaign: string | undefined, token: number) {
    this.ready.set(false);
    if (campaign && campaign !== this.library.selected()?.id)
      await this.library.select(campaign, false);
    if (!this.active || token !== this.routeToken) return;
    const selected = this.library.selected()?.id;
    if (selected && selected !== this.state.campaign()) await this.state.selectCampaign(selected);
    if (this.active && token === this.routeToken) this.ready.set(true);
  }
  async selectCampaign(id: string) {
    this.researchRequest++;
    if (!(await this.state.allowLeave())) return;
    await this.router.navigate(['/writing'], { queryParams: { campaign: id, view: 'library' } });
  }
  async registered() {
    const id = this.library.selected()?.id;
    if (id && id !== this.state.campaign()) await this.state.selectCampaign(id);
  }
  async prepare(mode: 'prepare' | 'play' = 'prepare') {
    const origin = this.route.snapshot.queryParams;
    await this.router.navigate(['/'], {
      queryParams: { ...origin, mode, view: origin['session'] ? 'prepare' : 'library' },
    });
  }
  changeMode(mode: WorkbenchMode) {
    this.researchRequest++;
    if (mode === 'library') {
      void this.router.navigate(['/library'], { queryParams: this.route.snapshot.queryParams });
    } else if (mode !== 'write') void this.prepare(mode);
  }
  reviewExport() {
    this.exportOpen.set(true);
    requestAnimationFrame(() =>
      this.exportPanel()?.nativeElement.scrollIntoView({ block: 'start' }),
    );
  }
  chooseArtwork(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.state.selectArtwork(input.files[0]);
    input.value = '';
  }
  async openDraft(id: string) {
    this.researchRequest++;
    await this.state.open(id);
  }
  async create() {
    this.researchRequest++;
    await this.state.create(this.newType, this.template);
    this.editorTab.set('document');
    this.full.set(false);
    this.newOpen.set(false);
  }
  count(type: string) {
    return this.state.drafts().filter((d) => d.fields.type === type).length;
  }
  tags(value: string) {
    this.state.edit({ tags: value ? value.split(',') : [] });
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.state.deleting() || this.state.status() !== 'saved') {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  ngOnDestroy() {
    this.active = false;
    this.researchRequest++;
    this.subscription?.unsubscribe();
    if (this.library.beforeSelect === this.selectGuard)
      this.library.beforeSelect = async () => true;
    this.state.deactivate();
  }
}
