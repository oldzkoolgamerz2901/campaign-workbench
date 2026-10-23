import { Component, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Subscription, firstValueFrom } from 'rxjs';
import {
  CheckedLink,
  ArtworkControllerService,
  LibraryEntry,
  PreparationControllerService,
} from '../../api/generated';
import { WorkbenchHeader, WorkbenchMode } from '../shared/workbench-header/workbench-header';
import { NavigationContext } from '../shared/navigation-context';
import { ArtworkImage, ArtworkSource } from '../shared/artwork/artwork-image';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { ReaderPresentation } from '../shared/reader/reader-presentation';
import { ReaderControls } from '../shared/reader/reader-controls';
import { DraftReader } from '../writing/draft-reader';
import { CampaignControls } from './campaign-controls';
import { LibraryState } from './library-state';
import { LibraryFiltersControl, LIBRARY_FILTER_STATE } from './library-filters';
import { UnifiedLibraryState } from './unified-library-state';
@Component({
  selector: 'unified-library',
  imports: [
    FormsModule,
    MatButtonModule,
    WorkbenchHeader,
    ArtworkImage,
    PlayingCard,
    ReaderPresentation,
    ReaderControls,
    DraftReader,
    CampaignControls,
    LibraryFiltersControl,
  ],
  providers: [{ provide: LIBRARY_FILTER_STATE, useExisting: UnifiedLibraryState }],
  templateUrl: './unified-library.html',
  styleUrl: './unified-library.css',
})
export class UnifiedLibrary implements OnDestroy {
  readonly state = inject(UnifiedLibraryState);
  readonly campaigns = inject(LibraryState);
  readonly context = inject(NavigationContext);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly artworkApi = inject(ArtworkControllerService);
  private readonly sessionsApi = inject(PreparationControllerService);
  readonly sourceReader = viewChild(ReaderPresentation);
  readonly draftReader = viewChild(DraftReader);
  readonly management = signal(false);
  readonly choosing = signal(false);
  readonly creating = signal(false);
  title = '';
  private subscription?: Subscription;
  private active = true;
  private routeRequest = 0;
  constructor() {
    effect(() => {
      const selected = this.campaigns.selected()?.id;
      const current = this.state.campaign();
      const routed = this.route.snapshot.queryParamMap.get('campaign');
      if (selected && selected !== current && (!routed || routed === current))
        void this.selectCampaign(selected);
    });
    void this.initialize();
  }
  destinationTitle() {
    return (
      this.context.sessions().find((s) => s.id === this.state.session())?.title ??
      (this.state.session() ? 'Loading selected session…' : 'No session selected')
    );
  }
  private async initialize() {
    await this.campaigns.initialize(false);
    if (!this.active) return;
    if (!this.campaigns.campaigns().length) this.management.set(true);
    this.subscription = this.route.queryParamMap.subscribe((params) => {
      const request = ++this.routeRequest;
      void (async () => {
        const campaign = params.get('campaign') ?? this.campaigns.selected()?.id ?? '';
        if (!params.has('campaign') && campaign) {
          await this.router.navigate([], {
            queryParams: { campaign },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
          return;
        }
        if (campaign && campaign !== this.campaigns.selected()?.id)
          await this.campaigns.select(campaign, false);
        if (!this.active || request !== this.routeRequest) return;
        await this.state.bind(campaign, params.get('session') ?? '');
        if (this.active && request === this.routeRequest && params.get('session'))
          this.choosing.set(false);
      })();
    });
    await this.state.reload();
  }
  ngOnDestroy() {
    this.active = false;
    this.state.detach();
    this.routeRequest++;
    this.subscription?.unsubscribe();
  }
  selectCampaign(campaign: string) {
    return this.router.navigate(['/library'], { queryParams: { campaign } });
  }
  navigate(mode: WorkbenchMode) {
    return this.router.navigate(
      [mode === 'write' ? '/writing' : mode === 'library' ? '/library' : '/'],
      {
        queryParams: {
          campaign: this.state.campaign(),
          session: this.state.session() || null,
          mode,
          view: 'prepare',
        },
      },
    );
  }
  async edit() {
    const campaign = this.state.campaign(),
      draft = await this.state.edit();
    if (draft && campaign === this.state.campaign())
      await this.router.navigate(['/writing'], {
        queryParams: { campaign, session: this.state.session() || null, draft },
      });
  }
  viewPrepared(item?: string) {
    return this.router.navigate(['/'], {
      queryParams: {
        campaign: this.state.campaign(),
        session: this.state.session(),
        item,
        view: 'prepare',
        mode: 'prepare',
      },
    });
  }
  async create() {
    const campaign = this.state.campaign();
    if (!campaign || !this.title.trim() || this.creating()) return;
    this.creating.set(true);
    try {
      const session = await firstValueFrom(
        this.sessionsApi.createSession(campaign, { title: this.title.trim(), objective: '' }),
      );
      if (!this.active || campaign !== this.state.campaign()) return;
      this.title = '';
      await this.context.reload();
      await this.context.select(session.id);
    } catch {
      this.state.error.set(
        'Cannot create session. Check sessions before retrying an uncertain request.',
      );
    } finally {
      this.creating.set(false);
    }
  }
  artwork(entry: LibraryEntry, variant: 'DISPLAY' | 'THUMBNAIL' = 'DISPLAY'): ArtworkSource | null {
    const campaign = this.state.campaign(),
      draft = entry.draft;
    return entry.image && draft
      ? {
          key: `library:${campaign}:${draft}:${entry.image.hash}:${variant}`,
          load: () => this.artworkApi.getDraftArtwork(campaign, draft, variant),
        }
      : null;
  }
  async follow(
    link: Pick<CheckedLink, 'kind'> &
      Partial<Pick<CheckedLink, 'path' | 'draft' | 'section' | 'anchor'>>,
  ) {
    await this.state.follow(link);
    setTimeout(() => {
      if (!this.active) return;
      const document = this.state.document();
      const entry = document?.entry;
      if (
        link.kind === 'draft'
          ? entry?.draft !== link.draft
          : !entry?.sources?.some((s) => s.path === link.path)
      )
        return;
      const preview = document?.draftPreview?.preview;
      const section = link.section ?? (link.anchor ? preview?.anchors[link.anchor] : null);
      if (!section) return;
      const sections = preview?.sections ?? document?.source?.sections ?? [];
      const index = sections.findIndex((s) => s.id === section);
      if (index >= 0)
        (preview ? this.draftReader()?.presentation() : this.sourceReader())?.go(index);
      else this.state.error.set('The linked section is unavailable in this document revision.');
    });
  }
  followSource(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    if (!anchor) return;
    event.preventDefault();
    const source = this.state.document()?.source;
    const link = source?.links.find((l) => anchor.getAttribute('href') === `#${l.key}`);
    if (!link || link.missing) {
      this.state.error.set('Link target unavailable in this capture.');
      return;
    }
    if (link.external) {
      window.open(link.external, '_blank', 'noopener,noreferrer');
      return;
    }
    if (link.document === source?.path) {
      if (link.section)
        this.sourceReader()?.go(source.sections.findIndex((s) => s.id === link.section));
    } else if (link.document)
      void this.follow({ kind: 'source', path: link.document, section: link.section });
  }
}
