import { CdkScrollable } from '@angular/cdk/scrolling';
import { CdkDropList } from '@angular/cdk/drag-drop';
import {
  SharingGestures,
  SharingDragSource,
  SharingDropTarget,
  SharingDrag,
  SharingDrop,
  SharingDestination,
} from './sharing-gestures';
import {
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
  ElementRef,
  Injector,
  afterNextRender,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { HttpErrorResponse } from '@angular/common/http';
import { CardLifecycleControllerService } from '../../api/generated/api/cardLifecycleController.service';
import type { RemovedSharedCard } from '../../api/generated/model/removedSharedCard';
import { DistributionControllerService } from '../../api/generated/api/distributionController.service';
import type {
  SharedCardPreview,
  DistributeCard,
  SharedCardData,
  SharedPile,
  OrganizeCollection,
} from '../../api/generated';
import { OrganizationControllerService } from '../../api/generated/api/organizationController.service';
import { SharedCardTray } from './shared-card-tray';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';
import { WorkbenchHeader, WorkbenchMode } from '../shared/workbench-header/workbench-header';
import { PlayingCard } from '../shared/playing-card/playing-card';
import { ArtworkSource } from '../shared/artwork/artwork-image';
import {
  CampaignControllerService,
  SharingControllerService,
  GatewayControllerService,
  GatewayAccessControllerService,
  PreparationControllerService,
  PreparedArtworkControllerService,
  Campaign,
  CampaignPlayerData,
  DeviceData,
  GatewayAccess,
  PairingInvitationData,
  PreparedItemData,
} from '../../api/generated';

@Component({
  selector: 'share-workspace',
  providers: [SharingGestures],
  imports: [
    CdkScrollable,
    CdkDropList,
    SharingDragSource,
    SharingDropTarget,
    FormsModule,
    WorkbenchHeader,
    PlayingCard,
    MatButtonModule,
    SharedCardTray,
  ],
  templateUrl: './share-workspace.html',
  styleUrl: './share-workspace.css',
})
export class ShareWorkspace implements OnDestroy {
  readonly gestures = inject(SharingGestures);
  readonly collectionDestinations = computed(() => [
    { id: 'group', name: 'Group' },
    ...this.players().map((p) => ({ id: p.id, name: p.displayName })),
  ]);
  readonly dropDestinations = computed<SharingDestination[]>(() => [
    ...this.collectionDestinations(),
    ...(this.collection() !== 'group'
      ? this.groupPiles().map((p) => ({ id: 'group', name: 'Group · ' + p.name, pile: p.id }))
      : []),
  ]);
  acceptDestination(id: string) {
    return (source: SharingDrag) =>
      !this.busy() &&
      !this.lifecycleBusy() &&
      !!this.access() &&
      (source.kind === 'source' || (source.mode === 'INVENTORY' && source.collection !== id));
  }
  async gestureDrop(event: SharingDrop) {
    if (this.busy() || this.lifecycleBusy() || !this.access()) return;
    const { source, target } = event,
      destination = target.collection || 'group';
    if (source.kind === 'source') {
      const item = this.items().find((i) => i.id === source.id);
      if (item) await this.share(item, destination, target.pile || '');
    } else {
      const card = this.sharedCards().find((c) => c.id === source.id);
      if (!card || card.mode !== 'INVENTORY' || source.collection === destination) return;
      this.transferDestination.set(destination);
      this.transferPile.set(target.pile || '');
      await this.transferCard(card, destination, target.pile || undefined);
    }
  }
  private readonly collectionTray = viewChild(SharedCardTray);
  private async transferCard(card: SharedCardData, destination: string, pile?: string) {
    this.collectionTray()?.rememberCommand(card.id);
    await this.runLifecycle(
      () =>
        firstValueFrom(
          this.lifecycle.transferSharedCard(
            this.campaign(),
            card.id,
            {
              recipient: destination === 'group' ? null : destination,
              pile: destination === 'group' ? pile : undefined,
            },
            'body',
            false,
            this.json,
          ),
        ),
      destination,
    );
  }

  private readonly json = { httpHeaderAccept: 'application/json' as const, transferCache: false };
  private readonly api = inject(SharingControllerService);
  private readonly organization = inject(OrganizationControllerService);
  readonly sharedPiles = signal<SharedPile[]>([]);
  readonly groupPiles = signal<SharedPile[]>([]);
  readonly deliveryPile = signal('');
  readonly newPileName = signal('');
  readonly transferPile = signal('');
  async organize(request: OrganizeCollection) {
    if (this.collection() !== 'group' || !this.access() || this.lifecycleBusy()) return;
    await this.runLifecycle(
      () =>
        firstValueFrom(
          this.organization.organizeGroupCollection(
            this.campaign(),
            request,
            'body',
            false,
            this.json,
          ),
        ),
      undefined,
      true,
    );
  }
  private readonly lifecycle = inject(CardLifecycleControllerService);
  readonly lifecycleCard = signal<SharedCardData | null>(null);
  readonly lifecycleAction = signal('');
  readonly transferDestination = signal('group');
  readonly lifecycleBusy = signal(false);
  readonly lifecycleError = signal('');
  readonly removedCards = signal<RemovedSharedCard[]>([]);
  private readonly lifecycleDialog = viewChild<ElementRef<HTMLDialogElement>>('lifecycleDialog');
  private readonly recoveryDialog = viewChild<ElementRef<HTMLDialogElement>>('recoveryDialog');
  private readonly recoveryClose = viewChild('recoveryClose', {
    read: ElementRef<HTMLButtonElement>,
  });
  readonly cardActions = (card: SharedCardData) =>
    card.mode === 'INVENTORY'
      ? [...(this.collection() !== 'group' || this.players().length ? ['Transfer'] : []), 'Remove']
      : ['Withdraw'];
  recipientName(id: string | null) {
    return id
      ? this.players().find((player) => player.id === id)?.displayName || 'Unavailable player'
      : 'Group';
  }
  openCardCommand(event: { card: SharedCardData; action: string }) {
    if (this.lifecycleBusy() || !this.access()) return;
    this.lifecycleCard.set(event.card);
    this.lifecycleAction.set(event.action);
    this.transferDestination.set(
      this.collection() === 'group' ? this.players()[0]?.id || '' : 'group',
    );
    this.transferPile.set('');
    void this.loadGroupPiles();
    this.lifecycleError.set('');
    this.lifecycleDialog()?.nativeElement.showModal();
  }
  async openRecovery() {
    this.lifecycleError.set('');
    this.removedCards.set([]);
    this.recoveryDialog()?.nativeElement.showModal();
    await this.refreshRemoved();
  }
  private async refreshRemoved() {
    const campaign = this.campaign(),
      epoch = this.epoch;
    try {
      const data = await firstValueFrom(
        this.lifecycle.getRemovedSharedCards(campaign, 'body', false, this.json),
      );
      if (epoch === this.epoch) this.removedCards.set(data.cards);
    } catch {
      if (epoch === this.epoch)
        this.lifecycleError.set('Cannot load removed cards. Close and retry when connected.');
    }
  }
  async confirmCardCommand() {
    const card = this.lifecycleCard();
    if (!card || this.lifecycleBusy() || !this.access()) return;
    const action = this.lifecycleAction(),
      campaign = this.campaign();
    if (action === 'Transfer')
      await this.transferCard(card, this.transferDestination(), this.transferPile() || undefined);
    else
      await this.runLifecycle(() =>
        firstValueFrom(
          this.lifecycle.removeSharedCard(campaign, card.id, 'body', false, this.json),
        ),
      );
  }

  async restoreCard(entry: RemovedSharedCard) {
    if (this.lifecycleBusy() || !this.access()) return;
    await this.runLifecycle(
      () =>
        firstValueFrom(
          this.lifecycle.restoreSharedCard(
            this.campaign(),
            entry.card.id,
            'body',
            false,
            this.json,
          ),
        ),
      entry.recipient || 'group',
    );
  }
  private async runLifecycle(
    action: () => Promise<unknown>,
    destination?: string,
    organization = false,
  ) {
    const epoch = this.epoch;
    this.lifecycleBusy.set(true);
    this.lifecycleError.set('');
    ++this.collectionRequest;
    try {
      await action();
      if (epoch !== this.epoch) return;
      this.lifecycleDialog()?.nativeElement.close();
      if (destination && destination !== this.collection())
        this.newDestinations.update((values) => [...new Set([...values, destination])]);
      this.notice.set(organization ? 'Organization updated.' : 'Card updated.');
      await this.refreshCollection();
      if (this.recoveryDialog()?.nativeElement.open) {
        await this.refreshRemoved();
        afterNextRender(() => this.recoveryClose()?.nativeElement.focus(), {
          injector: this.injector,
        });
      }
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.lifecycleError.set(
        error instanceof HttpErrorResponse && error.status === 409
          ? organization
            ? 'Organization changed. Refresh and try again; a nonempty pile requires confirmation.'
            : 'This card is no longer available for that action. Close and refresh.'
          : organization && error instanceof HttpErrorResponse && error.status === 400
            ? 'Enter a pile name of 1–200 characters.'
            : 'The result could not be confirmed. Reconnect and refresh before trying again.',
      );
      this.error.set(this.lifecycleError());
      await this.refresh(true);
      if (this.recoveryDialog()?.nativeElement.open) await this.refreshRemoved();
    } finally {
      this.lifecycleBusy.set(false);
    }
  }
  private readonly distribution = inject(DistributionControllerService);
  readonly sharedCards = signal<SharedCardData[]>([]);
  readonly preview = signal<SharedCardPreview | null>(null);
  readonly deliveryError = signal('');
  readonly deliveryBusy = signal(false);
  readonly uncertain = signal(false);
  readonly previewImageReady = signal(false);
  readonly newDestinations = signal<string[]>([]);
  readonly destination = signal('group');
  readonly deliveryMode = signal<'' | 'HANDOUT' | 'INVENTORY'>('');
  private delivery: DistributeCard | null = null;
  private sourceItem = '';
  private collectionRequest = 0;
  private readonly deliveryDialog = viewChild<ElementRef<HTMLDialogElement>>('deliveryDialog');
  readonly sharedArtwork = (card: SharedCardData): ArtworkSource | null =>
    card.artwork
      ? {
          key: `${this.campaign()}.${card.id}`,
          load: () => this.distribution.getSharedArtwork(this.campaign(), card.id),
        }
      : null;
  readonly previewArtwork = (): ArtworkSource | null =>
    this.preview()?.artwork && this.delivery
      ? {
          key: `${this.campaign()}.${this.delivery.fingerprint}`,
          load: () => {
            const fingerprint = this.delivery!.fingerprint;
            return this.distribution.previewSharedArtwork(this.campaign(), this.delivery!).pipe(
              tap({
                next: () => {
                  if (this.delivery?.fingerprint === fingerprint) this.previewImageReady.set(true);
                },
                error: () => {
                  if (this.delivery?.fingerprint === fingerprint) this.previewImageReady.set(false);
                },
              }),
            );
          },
        }
      : null;
  async chooseCollection(value: string) {
    this.gestures.cancel();
    this.collection.set(value);
    this.newDestinations.update((values) => values.filter((id) => id !== value));
    this.sharedCards.set([]);
    this.sharedPiles.set([]);
    try {
      await this.refreshCollection();
      if (value !== 'group') await this.loadGroupPiles();
    } catch {
      this.error.set('Cannot refresh this collection. Retry when connected.');
    }
  }
  private async refreshCollection() {
    const generation = ++this.collectionRequest;
    const epoch = this.epoch,
      campaign = this.campaign(),
      collection = this.collection();
    const result = await firstValueFrom(
      this.distribution.getSharedCollection(
        campaign,
        collection === 'group' ? undefined : collection,
        'body',
        false,
        this.json,
      ),
    );
    if (
      epoch === this.epoch &&
      generation === this.collectionRequest &&
      collection === this.collection()
    ) {
      this.sharedCards.set(result.cards);
      this.sharedPiles.set(result.piles);
      if (collection === 'group') this.groupPiles.set(result.piles);
      if (
        this.lifecycleCard() &&
        !result.cards.some((card) => card.id === this.lifecycleCard()!.id)
      )
        this.lifecycleDialog()?.nativeElement.close();
    }
  }
  private async loadGroupPiles() {
    const epoch = this.epoch;
    try {
      const data = await firstValueFrom(
        this.distribution.getSharedCollection(this.campaign(), undefined, 'body', false, this.json),
      );
      if (epoch === this.epoch) this.groupPiles.set(data.piles);
    } catch {
      if (epoch === this.epoch) this.groupPiles.set([]);
    }
  }
  async share(item: PreparedItemData, destination = this.collection(), pile = '') {
    this.rememberFocus();
    if (this.uncertain() && this.delivery && this.preview()) {
      this.deliveryDialog()?.nativeElement.showModal();
      return;
    }
    this.sourceItem = item.id;
    this.destination.set(destination);
    this.deliveryPile.set(pile);
    this.newPileName.set('');
    void this.loadGroupPiles();
    this.deliveryMode.set('');
    this.deliveryError.set('');
    this.uncertain.set(false);
    this.preview.set(null);
    this.delivery = null;
    this.deliveryDialog()?.nativeElement.showModal();
    await this.reviewDelivery();
  }
  async reviewDelivery() {
    const session = this.route.snapshot.queryParamMap.get('session');
    if (!session) return;
    const epoch = this.epoch;
    this.previewImageReady.set(false);
    this.deliveryBusy.set(true);
    this.deliveryError.set('');
    try {
      const preview = await firstValueFrom(
        this.distribution.previewSharedCard(
          this.campaign(),
          { session, item: this.sourceItem },
          'body',
          false,
          this.json,
        ),
      );
      if (epoch !== this.epoch || !this.deliveryDialog()?.nativeElement.open) return;
      this.delivery = {
        operation: crypto.randomUUID(),
        session,
        item: this.sourceItem,
        fingerprint: preview.fingerprint,
        mode: 'HANDOUT',
        recipient: null,
      };
      this.preview.set(preview);
      this.previewImageReady.set(!preview.artwork);
      this.uncertain.set(false);
    } catch {
      if (epoch === this.epoch) this.deliveryError.set('Cannot load preview. Retry review.');
    } finally {
      if (epoch === this.epoch) this.deliveryBusy.set(false);
    }
  }
  async confirmDelivery() {
    if (
      !this.delivery ||
      !this.deliveryMode() ||
      this.deliveryBusy() ||
      !this.previewImageReady() ||
      (this.destination() === 'group' &&
        this.deliveryPile() === 'new' &&
        !this.newPileName().trim())
    )
      return;
    const epoch = this.epoch;
    if (!this.uncertain())
      this.delivery = {
        ...this.delivery,
        mode: this.deliveryMode() as 'HANDOUT' | 'INVENTORY',
        recipient: this.destination() === 'group' ? null : this.destination(),
        pile:
          this.destination() === 'group' && this.deliveryPile() !== 'new'
            ? this.deliveryPile() || undefined
            : undefined,
        newPile:
          this.destination() === 'group' && this.deliveryPile() === 'new'
            ? this.newPileName()
            : undefined,
      };
    this.deliveryBusy.set(true);
    this.deliveryError.set('');
    try {
      await firstValueFrom(
        this.distribution.distributeSharedCard(
          this.campaign(),
          this.delivery,
          'body',
          false,
          this.json,
        ),
      );
      if (epoch !== this.epoch) return;
      const destination = this.delivery.recipient || 'group';
      if (destination !== this.collection())
        this.newDestinations.update((values) => [...new Set([...values, destination])]);
      this.notice.set('Card shared.');
      this.uncertain.set(false);
      this.deliveryDialog()?.nativeElement.close();
      this.preview.set(null);
      try {
        await this.refreshCollection();
      } catch {
        this.error.set('Card shared; collection refresh failed. Retry refresh.');
      }
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.delivery = null;
        this.preview.set(null);
        void this.loadGroupPiles();
        this.deliveryError.set(
          error.error?.code === 'sharing.destination'
            ? 'Destination changed. Choose a current destination and review again.'
            : 'Prepared card changed. Review again before sharing.',
        );
      } else {
        this.uncertain.set(true);
        this.deliveryError.set(
          'Delivery could not be confirmed. Retry this delivery to avoid a duplicate.',
        );
      }
    } finally {
      if (epoch === this.epoch) this.deliveryBusy.set(false);
    }
  }

  private readonly gateway = inject(GatewayControllerService);
  private readonly accessApi = inject(GatewayAccessControllerService);
  private readonly campaignsApi = inject(CampaignControllerService);
  private readonly preparation = inject(PreparationControllerService);
  private readonly artworkApi = inject(PreparedArtworkControllerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly campaigns = signal<Campaign[]>([]);
  readonly campaign = signal('');
  readonly players = signal<CampaignPlayerData[]>([]);
  readonly access = signal<GatewayAccess | null>(null);
  readonly address = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly items = signal<PreparedItemData[]>([]);
  readonly collection = signal('group');
  readonly devices = signal<DeviceData[]>([]);
  readonly managed = signal<CampaignPlayerData | null>(null);
  readonly pairing = signal<PairingInvitationData | null>(null);
  readonly pairPlayer = signal<CampaignPlayerData | null>(null);
  readonly pairState = signal('');
  readonly qr = signal('');
  readonly now = signal(Date.now());
  readonly editing = signal<CampaignPlayerData | null>(null);
  name = '';
  readonly filter = signal('');
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('shareHeading');
  private modalTarget: HTMLElement | null = null;
  private pendingFocus = false;
  private epoch = 0;
  private pairEpoch = 0;
  private refreshing = false;
  private readonly nameDialog = viewChild<ElementRef<HTMLDialogElement>>('nameDialog');
  private readonly devicesDialog = viewChild<ElementRef<HTMLDialogElement>>('devicesDialog');
  private readonly pairDialog = viewChild<ElementRef<HTMLDialogElement>>('pairDialog');
  readonly visibleItems = computed(() =>
    this.items().filter(
      (item) => !this.filter() || item.title.toLowerCase().includes(this.filter().toLowerCase()),
    ),
  );
  readonly link = computed(() => {
    const code = this.pairing(),
      port = this.access()?.gateway?.port,
      address = this.address();
    return code && port && address
      ? `http://${address}:${port}/player/pair#token=${encodeURIComponent(code.token)}`
      : '';
  });
  readonly seconds = computed(() =>
    Math.max(0, Math.ceil((Date.parse(this.pairing()?.expiresAt || '') - this.now()) / 1000)),
  );
  readonly canPair = computed(
    () =>
      !!this.access()?.gateway?.enabled &&
      this.access()?.gateway?.campaign === this.campaign() &&
      !!this.access()?.playerAssetsReady &&
      !!this.address(),
  );
  private readonly timer = setInterval(() => {
    this.now.set(Date.now());
    void this.refresh();
  }, 2000);
  private readonly routeSubscription = this.route.queryParamMap.subscribe(() => void this.load());
  constructor() {
    this.lifecycle.defaultHeaders = this.lifecycle.defaultHeaders.set(
      'Content-Type',
      'application/json',
    );
    // Generated bodyless mutation methods do not set Content-Type themselves.
    this.api.defaultHeaders = this.api.defaultHeaders.set('Content-Type', 'application/json');
    this.gateway.defaultHeaders = this.gateway.defaultHeaders.set(
      'Content-Type',
      'application/json',
    );
  }
  private async load() {
    this.gestures.cancel();
    const epoch = ++this.epoch;
    this.closeDialogs();
    this.busy.set(true);
    this.error.set('');
    this.items.set([]);
    this.sharedCards.set([]);
    this.sharedPiles.set([]);
    this.newDestinations.set([]);
    this.notice.set('');
    this.lifecycleDialog()?.nativeElement.close();
    this.recoveryDialog()?.nativeElement.close();
    this.removedCards.set([]);
    this.collection.set('group');
    this.players.set([]);
    this.access.set(null);
    try {
      const list = await firstValueFrom(this.campaignsApi.listCampaigns('body', false, this.json));
      if (epoch !== this.epoch) return;
      this.campaigns.set(list.campaigns);
      const id = this.route.snapshot.queryParamMap.get('campaign') || list.selected || '';
      this.campaign.set(id);
      if (!id) return;
      if (list.selected !== id)
        await firstValueFrom(this.campaignsApi.selectCampaign(id, 'body', false, this.json));
      if (epoch !== this.epoch) return;
      await this.refresh(true);
      const session = this.route.snapshot.queryParamMap.get('session');
      if (session) {
        const data = await firstValueFrom(
          this.preparation.openSession(id, session, 'body', false, this.json),
        );
        if (epoch === this.epoch) this.items.set(data.items);
      }
    } catch {
      if (epoch === this.epoch)
        this.error.set('Cannot load sharing. Check the connection and retry.');
    } finally {
      if (epoch === this.epoch) {
        this.busy.set(false);
        this.restoreFocus();
      }
    }
  }
  async refresh(force = false) {
    if (!this.campaign() || (this.refreshing && !force)) return;
    const epoch = this.epoch,
      campaign = this.campaign();
    this.refreshing = true;
    try {
      const [players, access] = await Promise.all([
        firstValueFrom(this.api.listCampaignPlayers(campaign, 'body', false, this.json)),
        firstValueFrom(this.accessApi.getGatewayAccess('body', false, this.json)),
      ]);
      if (epoch !== this.epoch) return;
      this.players.set(players.players);
      await this.refreshCollection();
      if (this.collection() !== 'group') await this.loadGroupPiles();
      if (
        this.pairing() &&
        (this.access()?.gateway?.port !== access.gateway?.port ||
          this.access()?.gateway?.campaign !== access.gateway?.campaign)
      )
        this.endPairing();
      this.access.set(access);
      if (this.recoveryDialog()?.nativeElement.open && !this.lifecycleBusy())
        await this.refreshRemoved();
      const addresses = access.addresses || [];
      if (!addresses.some((candidate) => candidate.address === this.address())) {
        this.endPairing();
        this.address.set(addresses[0]?.address || '');
      }
      const pairing = this.pairing(),
        player = this.pairPlayer();
      if (pairing && player && this.pairDialog()?.nativeElement.open) {
        if (!this.canPair() || !players.players.find((p) => p.id === player.id)?.active) {
          this.endPairing();
          return;
        }
        const generation = this.pairEpoch;
        const state = await firstValueFrom(
          this.api.getPlayerPairingStatus(
            campaign,
            player.id,
            pairing.id,
            'body',
            false,
            this.json,
          ),
        );
        if (epoch === this.epoch && generation === this.pairEpoch) this.pairState.set(state.state);
      }
    } catch {
      if (epoch === this.epoch) {
        this.access.set(null);
        this.error.set('Sharing connection unavailable. Retry when the application is reachable.');
        this.endPairing();
      }
    } finally {
      this.refreshing = false;
    }
  }
  private async mutate(action: () => Promise<unknown>) {
    if (this.busy()) return;
    const epoch = this.epoch;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
      if (epoch === this.epoch) await this.refresh(true);
    } catch {
      if (epoch === this.epoch)
        this.error.set('The change could not be completed. Refresh and retry.');
    } finally {
      if (epoch === this.epoch) {
        this.busy.set(false);
        this.restoreFocus();
      }
    }
  }
  async selectCampaign(id: string) {
    const epoch = this.epoch;
    await this.mutate(async () => {
      this.closeDialogs();
      await firstValueFrom(this.campaignsApi.selectCampaign(id, 'body', false, this.json));
      if (epoch === this.epoch)
        await this.router.navigate(['/share'], { queryParams: { campaign: id } });
    });
  }
  navigate(mode: WorkbenchMode) {
    const target =
      mode === 'library'
        ? '/library'
        : mode === 'write'
          ? '/writing'
          : mode === 'share'
            ? '/share'
            : '/';
    void this.router.navigate([target], {
      queryParams: { ...this.route.snapshot.queryParams, mode },
    });
  }
  openName(player: CampaignPlayerData | null = null) {
    this.rememberFocus();
    this.editing.set(player);
    this.name = player?.displayName || '';
    this.nameDialog()?.nativeElement.showModal();
  }
  async saveName() {
    const name = this.name.trim();
    if (!name || name.length > 200) return;
    const player = this.editing(),
      epoch = this.epoch;
    await this.mutate(async () => {
      if (player)
        await firstValueFrom(
          this.api.renameCampaignPlayer(
            this.campaign(),
            player.id,
            { displayName: name },
            'body',
            false,
            this.json,
          ),
        );
      else
        await firstValueFrom(
          this.api.addCampaignPlayer(
            this.campaign(),
            { displayName: name },
            'body',
            false,
            this.json,
          ),
        );
      if (epoch === this.epoch) this.nameDialog()?.nativeElement.close();
    });
  }
  async activate(player: CampaignPlayerData) {
    await this.mutate(() =>
      firstValueFrom(
        this.api.setCampaignPlayerActive(
          this.campaign(),
          player.id,
          { active: !player.active },
          'body',
          false,
          this.json,
        ),
      ),
    );
  }
  async enable() {
    await this.mutate(() => firstValueFrom(this.gateway.enableGateway('body', false, this.json)));
  }
  async disable() {
    this.endPairing();
    await this.mutate(() => firstValueFrom(this.gateway.disableGateway('body', false, this.json)));
  }
  async manage(player: CampaignPlayerData) {
    this.rememberFocus();
    const epoch = this.epoch;
    await this.mutate(async () => {
      const result = await firstValueFrom(
        this.api.listPlayerDevices(this.campaign(), player.id, 'body', false, this.json),
      );
      if (epoch === this.epoch) {
        this.managed.set(player);
        this.devices.set(result.devices);
        this.devicesDialog()?.nativeElement.showModal();
      }
    });
  }
  async revoke(device: DeviceData) {
    await this.mutate(async () => {
      await firstValueFrom(
        this.api.revokePlayerDevice(this.campaign(), device.id, 'body', false, this.json),
      );
      const player = this.managed();
      if (player)
        this.devices.set(
          (
            await firstValueFrom(
              this.api.listPlayerDevices(this.campaign(), player.id, 'body', false, this.json),
            )
          ).devices,
        );
    });
  }
  async pair(player: CampaignPlayerData, replace = false) {
    if (!this.canPair() || !player.active || this.busy()) return;
    if (!this.pairDialog()?.nativeElement.open) this.rememberFocus();
    const epoch = this.epoch,
      generation = ++this.pairEpoch,
      previous = replace ? this.pairing() : null;
    this.busy.set(true);
    this.error.set('');
    this.qr.set('');
    this.pairing.set(null);
    this.pairPlayer.set(player);
    this.pairState.set('preparing');
    if (!this.pairDialog()?.nativeElement.open) this.pairDialog()?.nativeElement.showModal();
    try {
      const result = previous
        ? await firstValueFrom(
            this.api.replacePlayerPairing(
              this.campaign(),
              player.id,
              previous.id,
              'body',
              false,
              this.json,
            ),
          )
        : await firstValueFrom(
            this.api.issuePlayerPairing(this.campaign(), player.id, 'body', false, this.json),
          );
      if (epoch !== this.epoch || generation !== this.pairEpoch) return;
      this.pairing.set(result);
      this.pairState.set('pending');
      this.now.set(Date.now());
      const qrModule = await import('qrcode');
      // CommonJS interop exposes only the default export in the development build.
      const QR = qrModule.default ?? qrModule;
      const data = await QR.toDataURL(this.link(), {
        width: 320,
        margin: 4,
        errorCorrectionLevel: 'M',
      });
      if (epoch === this.epoch && generation === this.pairEpoch) this.qr.set(data);
    } catch {
      if (epoch === this.epoch && generation === this.pairEpoch) {
        this.pairState.set('failed');
        this.error.set('Cannot prepare a pairing code. Close and retry.');
      }
    } finally {
      if (epoch === this.epoch) {
        this.busy.set(false);
        this.restoreFocus();
      }
    }
  }
  endPairing() {
    ++this.pairEpoch;
    this.pairDialog()?.nativeElement.close();
    this.pairing.set(null);
    this.qr.set('');
    this.pairPlayer.set(null);
  }
  private rememberFocus() {
    this.modalTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  private anyDialogOpen() {
    return [this.nameDialog(), this.devicesDialog(), this.pairDialog(), this.deliveryDialog()].some(
      (dialog) => dialog?.nativeElement.open,
    );
  }
  dialogClosed() {
    if (this.anyDialogOpen()) return;
    this.pendingFocus = true;
    this.restoreFocus();
  }
  pairClosed() {
    if (this.pairDialog()?.nativeElement.open) return;
    this.endPairing();
    this.dialogClosed();
  }
  private restoreFocus() {
    if (!this.pendingFocus || this.busy()) return;
    this.pendingFocus = false;
    const target = this.modalTarget;
    afterNextRender(
      () => {
        if (this.anyDialogOpen() || this.busy()) return;
        if (target?.isConnected && !target.matches(':disabled')) target.focus();
        else this.heading()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }
  private closeDialogs() {
    this.deliveryDialog()?.nativeElement.close();
    this.preview.set(null);
    this.delivery = null;
    this.uncertain.set(false);
    this.deliveryBusy.set(false);
    this.endPairing();
    this.nameDialog()?.nativeElement.close();
    this.devicesDialog()?.nativeElement.close();
  }
  source(item: PreparedItemData) {
    const metadata = item.capturedSource?.classification?.metadata;
    return {
      title: metadata?.title || item.title,
      type: metadata?.type || 'card',
      summary: metadata?.summary || '',
      tags: metadata?.tags || [],
      backText: metadata?.backText || '',
    };
  }
  artwork(item: PreparedItemData): ArtworkSource | null {
    const campaign = this.campaign(),
      session = this.route.snapshot.queryParamMap.get('session');
    return item.image && session
      ? {
          key: `${campaign}.${session}.${item.id}.${item.image.hash}`,
          load: () => this.artworkApi.getPreparedArtwork(campaign, session, item.id, 'DISPLAY'),
        }
      : null;
  }
  ngOnDestroy() {
    ++this.epoch;
    this.closeDialogs();
    clearInterval(this.timer);
    this.routeSubscription.unsubscribe();
  }
}
