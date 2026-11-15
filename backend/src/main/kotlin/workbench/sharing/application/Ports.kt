package workbench.sharing.application

import workbench.sharing.domain.*
import java.time.Instant
import java.util.UUID

interface SharingStore {
    fun players(campaign: UUID): List<CampaignPlayer>
    fun deviceCounts(campaign: UUID): Map<UUID, Int>
    fun invitationById(campaign: UUID, player: UUID, id: UUID): PairingInvitation?
    fun invalidate(campaign: UUID, id: UUID, now: Instant): Boolean
    fun player(campaign: UUID, id: UUID): CampaignPlayer?
    fun put(player: CampaignPlayer)
    fun put(invitation: PairingInvitation)
    fun invitation(campaign: UUID, hash: String): PairingInvitation?
    fun consume(campaign: UUID, hash: String, now: Instant): Boolean
    fun devices(campaign: UUID, player: UUID): List<PairedDevice>
    fun device(campaign: UUID, id: UUID): PairedDevice?
    fun credential(campaign: UUID, hash: String): PairedDevice?
    fun put(device: PairedDevice)
}
fun interface SharingClock { fun now(): Instant }
interface DeviceSecrets {
    fun generate(): String
    /** Reject malformed/oversized secrets before hashing. */
    fun hash(secret: String): String?
}
