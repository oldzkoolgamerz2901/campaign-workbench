import {
  Component,
  OnDestroy,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
import { ResearchContext } from '../writing/research-context';
import { NavigationContext } from '../shared/navigation-context';
import { ArtworkImage, ArtworkSource } from '../shared/artwork/artwork-image';
import { CardFitFeedback } from '../shared/card-layout/card-fit-feedback';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { ReaderPresentation } from '../shared/reader/reader-presentation';
import { ReaderControls } from '../shared/reader/reader-controls';
import { DraftReader } from '../writing/draft-reader';
import { CampaignControls } from './campaign-controls';
import { LibraryState } from './library-state';
import { LibraryFiltersControl, LIBRARY_FILTER_STATE } from './library-filters';
import { UnifiedLibraryState } from './unified-library-state';
import { LibraryAdventure } from './library-adventure';
@Component({
  selector: 'unified-library',
  imports: [
    FormsModule,
    MatButtonModule,
    WorkbenchHeader,
    ArtworkImage,
    PlayingCard,
    CardFitFeedback,
    ReaderPresentation,
    ReaderControls,
    DraftReader,
    CampaignControls,
    LibraryFiltersControl,
    LibraryAdventure,
  ],
  providers: [{ provide: LIBRARY_FILTER_STATE, useExisting: UnifiedLibraryState }],
  templateUrl: './unified-library.html',
  styleUrl: './unified-library.css',
})
export class UnifiedLibrary implements OnDestroy {
  readonly state = inject(UnifiedLibraryState);
  readonly campaigns = inject(LibraryState);
  readonly research = inject(ResearchContext);
  readonly context = inject(NavigationContext);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
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
  private openedReference: string | null = null;
  returnToWrite() {
    const saved = this.research.returnTo();
    if (saved)
      return this.router.navigate(['/writing'], {
        queryParams: {
          campaign: saved.campaign,
          session: saved.session,
          draft: saved.draft,
          research: 'return',
        },
      });
    return Promise.resolve(false);
  }
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
        const sameContext =
          campaign === this.state.campaign() &&
          (params.get('session') ?? '') === this.state.session();
        await this.state.bind(campaign, params.get('session') ?? '');
        if (sameContext) await this.state.reload();
        if (!this.active || request !== this.routeRequest) return;
        const reference = params.get('reference');
        if (reference && reference !== this.openedReference) {
          this.openedReference = reference;
          await this.state.openKey(
            reference,
            params.has('referenceCapture')
              ? {
                  capture: params.get('referenceCapture') || null,
                  draft: params.get('referenceDraft') || null,
                  revision: params.has('referenceRevision')
                    ? Number(params.get('referenceRevision'))
                    : null,
                }
              : undefined,
          );
          if (!this.state.stale())
            this.revealTarget(params.get('referenceSection'), params.get('referenceAnchor'));
        }
        if (this.active && request === this.routeRequest && params.get('session'))
          this.choosing.set(false);
      })();
    });
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
      [mode === 'share' ? '/share' : mode === 'write' ? '/writing' : mode === 'library' ? '/library' : '/'],
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
      Partial<Pick<CheckedLink, 'path' | 'draft' | 'revision' | 'section' | 'anchor'>>,
  ) {
    if (!(await this.state.follow(link))) return;
    const entry = this.state.document()?.entry;
    if (
      link.kind === 'draft'
        ? entry?.draft !== link.draft || entry?.revision !== link.revision
        : !entry?.sources?.some((s) => s.path === link.path)
    )
      return;
    this.revealTarget(link.section, link.anchor);
  }
  private revealTarget(sectionId?: string | null, anchor?: string | null) {
    const expected = this.state.document();
    afterNextRender(
      {
        read: () => {
          if (!this.active || this.state.document() !== expected) return;
          const document = this.state.document();
          const preview = document?.draftPreview?.preview;
          const section = preview && anchor ? preview.anchors[anchor] : sectionId;
          if (!section) {
            if (anchor)
              this.state.error.set('The linked heading is unavailable in this document revision.');
            return;
          }
          const presentation = preview ? this.draftReader()?.presentation() : this.sourceReader();
          const index =
            presentation?.headings().findIndex((heading) => heading.key === section) ?? -1;
          if (index >= 0) presentation?.go(index);
          else this.state.error.set('The linked section is unavailable in this document revision.');
        },
      },
      { injector: this.injector },
    );
  }

  followSource(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    if (!anchor) return;
    event.preventDefault();
    const source = this.state.document()?.source;
    const checked = this.state
      .document()
      ?.checkedLinks?.find((l) => anchor.getAttribute('href') === `#${l.key}`);
    if (checked) {
      if (checked.external) window.open(checked.external, '_blank', 'noopener,noreferrer');
      else if (
        checked.kind === 'local' ||
        (checked.kind === 'source' && checked.path === source?.path)
      ) {
        const index = checked.section
          ? this.sourceReader()
              ?.headings()
              .findIndex((h) => h.key === checked.section)
          : 0;
        if (index !== undefined && index >= 0) this.sourceReader()?.go(index);
      } else if (checked.kind === 'source' || checked.kind === 'draft') void this.follow(checked);
      else
        this.state.error.set(
          checked.warning
            ? `Link target unavailable. ${checked.warning}`
            : 'Link target unavailable in this Library revision.',
        );
      return;
    }
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
        this.sourceReader()?.go(
          this.sourceReader()!
            .headings()
            .findIndex((h) => h.key === link.section),
        );
    } else if (link.document)
      void this.follow({ kind: 'source', path: link.document, section: link.section });
  }
}
