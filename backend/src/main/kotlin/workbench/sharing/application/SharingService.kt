package workbench.sharing.application

import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sharing.api.*
import workbench.sharing.domain.*
import java.time.Duration
import java.util.UUID

class SharingService(private val campaigns: Campaigns, private val store: SharingStore, private val tx: Transactions,
    private val clock: SharingClock, private val secrets: DeviceSecrets, private val invitationLifetime: Duration) : PlayerAccess {
    init { require(!invitationLifetime.isNegative && !invitationLifetime.isZero) }
    fun players(campaign: UUID) = tx.run { either {
        campaigns.configuration(campaign).bind()
        CampaignPlayers(store.players(campaign).map { it.data() })
    } }
    fun add(campaign: UUID, request: AddCampaignPlayer) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val name = request.displayName.trim()
        ensure(name.isNotEmpty() && name.length <= 200) { Failure.Invalid("sharing.player-name", "Enter a player name of 1–200 characters.") }
        CampaignPlayer(UUID.randomUUID(), campaign, name, true).also(store::put).data()
    } }
    fun activate(campaign: UUID, player: UUID, active: Boolean) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val current = ensureNotNull(store.player(campaign, player)) { missing() }
        current.copy(active = active).also(store::put).data()
    } }
    fun invite(campaign: UUID, player: UUID) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val current = ensureNotNull(store.player(campaign, player)) { missing() }
        ensure(current.active) { inactive() }
        val now = clock.now()
        val token = secrets.generate()
        val invitation = PairingInvitation(campaign, player, requireNotNull(secrets.hash(token)), now, now.plus(invitationLifetime), null)
        store.put(invitation)
        PairingInvitationData(token, invitation.expiresAt.toString())
    } }
    override fun redeem(campaign: UUID, token: String) = tx.run { either {
        val hash = ensureNotNull(secrets.hash(token)) { unauthorized() }
        campaigns.configuration(campaign).bind()
        val invitation = ensureNotNull(store.invitation(campaign, hash)) { unauthorized() }
        val now = clock.now()
        ensure(invitation.usable(now)) { unauthorized() }
        val player = ensureNotNull(store.player(campaign, invitation.player)) { unauthorized() }
        ensure(player.active) { inactive() }
        ensure(store.consume(campaign, hash, now)) { unauthorized() }
        val credential = secrets.generate()
        val device = PairedDevice(UUID.randomUUID(), campaign, player.id, requireNotNull(secrets.hash(credential)), now, now, null)
        store.put(device)
        PairingResult(credential, identity(player, device))
    } }
    override fun identify(campaign: UUID, credential: String?) = tx.run { either {
        val hash = ensureNotNull(credential?.let(secrets::hash)) { unauthorized() }
        campaigns.configuration(campaign).bind()
        val device = ensureNotNull(store.credential(campaign, hash)) { unauthorized() }
        ensure(device.revokedAt == null) { unauthorized() }
        val player = ensureNotNull(store.player(campaign, device.player)) { unauthorized() }
        ensure(player.active) { inactive() }
        store.put(device.copy(lastSeenAt = clock.now()))
        identity(player, device)
    } }
    fun devices(campaign: UUID, player: UUID) = tx.run { either {
        campaigns.configuration(campaign).bind()
        ensureNotNull(store.player(campaign, player)) { missing() }
        PlayerDevices(store.devices(campaign, player).map { it.data() })
    } }
    fun revoke(campaign: UUID, device: UUID) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val current = ensureNotNull(store.device(campaign, device)) { missing() }
        current.copy(revokedAt = current.revokedAt ?: clock.now()).also(store::put).data()
    } }
    private fun CampaignPlayer.data() = CampaignPlayerData(id, campaign, displayName, active)
    private fun PairedDevice.data() = DeviceData(id, player, createdAt.toString(), lastSeenAt.toString(), revokedAt?.toString())
    private fun identity(player: CampaignPlayer, device: PairedDevice) = PlayerIdentity(player.campaign, player.id, device.id, player.displayName)
    private fun unauthorized() = Failure.Unauthenticated("sharing.credential", "Pairing or device credential is invalid, expired or no longer available.")
    private fun inactive() = Failure.Forbidden("sharing.player-inactive", "This player is inactive.")
    private fun missing() = Failure.NotFound("sharing.not-found", "Player or device not found in this campaign.")
}
