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
import { SourceControllerService, CheckedLink } from '../../api/generated';
import { CampaignLibrary } from '../campaigns/library';
import { WritingExportPanel } from './writing-export-panel';
import { LibraryState } from '../campaigns/library-state';
import { CampaignControls } from '../campaigns/campaign-controls';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { DraftReader } from './draft-reader';
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
    DraftReader,
    CampaignLibrary,
    WritingExportPanel,
  ],
  templateUrl: './writing-workspace.html',
  styleUrl: './writing-workspace.css',
})
export class WritingWorkspace implements OnDestroy {
  readonly artwork = inject(WritingArtwork);
  readonly state = inject(WritingState);
  readonly library = inject(LibraryState);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly ready = signal(false);
  readonly newOpen = signal(false);
  readonly detailsOpen = signal(false);
  readonly exportOpen = signal(false);
  readonly previewOpen = signal(true);
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
  readonly full = signal(false);
  readonly sourceChooser = signal(false);
  readonly sourceBusy = signal(false);
  readonly sourceNotice = signal('');
  forkType = '';
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
  private readonly selectGuard = async (_id: string) => {
    if (!(await this.state.allowLeave())) return false;
    return true;
  };
  constructor() {
    effect(() => this.state.contextChanged(this.library.library()?.capture));
    void this.initialize();
  }
  async openSources() {
    if (this.state.deleting()) return;
    this.sourceChooser.set(true);
    if (await this.recheckSources()) await this.library.searchAll();
  }
  async recheckSources() {
    if (this.state.deleting()) return false;
    const campaign = this.state.campaign();
    if (!campaign) return false;
    this.sourceBusy.set(true);
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
    } finally {
      this.sourceBusy.set(false);
    }
  }
  async copySource(source: { capture: string; path: string }) {
    if (await this.state.fork(source.capture, source.path, this.forkType || null)) {
      this.sourceChooser.set(false);
      this.full.set(false);
    }
  }
  async followTarget(link: CheckedLink) {
    if (this.state.deleting()) return;
    if (link.kind === 'draft' && link.draft) {
      await this.state.open(link.draft);
      this.full.set(true);
      return;
    }
    const expected = this.state.preview()?.capture;
    if (!(await this.recheckSources())) return;
    if (expected !== this.library.library()?.capture) {
      this.sourceNotice.set(
        'Source capture changed. Check the updated preview before opening this link.',
      );
      return;
    }
    if (link.path) {
      this.sourceChooser.set(true);
      await this.library.open(link.path, link.section);
    }
  }
  private async initialize() {
    await this.library.initialize();
    if (!this.active) return;
    this.library.beforeSelect = this.selectGuard;
    if (!this.library.campaigns().length) this.management.set(true);
    this.subscription = this.route.queryParamMap.subscribe((params) => {
      const token = ++this.routeToken;
      const campaign = params.get('campaign') ?? this.library.selected()?.id;
      void this.loadCampaign(campaign, token).then(async () => {
        if (this.active && token === this.routeToken && params.get('draft'))
          await this.state.open(params.get('draft')!);
      });
    });
  }
  private async loadCampaign(campaign: string | undefined, token: number) {
    this.ready.set(false);
    if (campaign && campaign !== this.library.selected()?.id) await this.library.select(campaign);
    if (!this.active || token !== this.routeToken) return;
    const selected = this.library.selected()?.id;
    if (selected && selected !== this.state.campaign()) await this.state.selectCampaign(selected);
    if (this.active && token === this.routeToken) this.ready.set(true);
  }
  async selectCampaign(id: string) {
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
    if (mode !== 'write') void this.prepare(mode);
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
  async create() {
    await this.state.create(this.newType, this.template);
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
    this.subscription?.unsubscribe();
    if (this.library.beforeSelect === this.selectGuard)
      this.library.beforeSelect = async () => true;
    this.state.deactivate();
  }
}
