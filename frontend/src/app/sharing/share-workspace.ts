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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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
  imports: [FormsModule, WorkbenchHeader, PlayingCard, MatButtonModule],
  templateUrl: './share-workspace.html',
  styleUrl: './share-workspace.css',
})
export class ShareWorkspace implements OnDestroy {
  private readonly json = { httpHeaderAccept: 'application/json' as const, transferCache: false };
  private readonly api = inject(SharingControllerService);
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
    // Generated bodyless mutation methods do not set Content-Type themselves.
    this.api.defaultHeaders = this.api.defaultHeaders.set('Content-Type', 'application/json');
    this.gateway.defaultHeaders = this.gateway.defaultHeaders.set(
      'Content-Type',
      'application/json',
    );
  }
  private async load() {
    const epoch = ++this.epoch;
    this.closeDialogs();
    this.busy.set(true);
    this.error.set('');
    this.items.set([]);
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
      if (
        this.pairing() &&
        (this.access()?.gateway?.port !== access.gateway?.port ||
          this.access()?.gateway?.campaign !== access.gateway?.campaign)
      )
        this.endPairing();
      this.access.set(access);
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
    return [this.nameDialog(), this.devicesDialog(), this.pairDialog()].some(
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
