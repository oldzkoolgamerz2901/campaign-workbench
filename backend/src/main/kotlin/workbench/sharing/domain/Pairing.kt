package workbench.sharing.domain

import java.time.Instant
import java.util.UUID

data class CampaignPlayer(val id: UUID, val campaign: UUID, val displayName: String, val active: Boolean)
data class PairingInvitation(val campaign: UUID, val player: UUID, val tokenHash: String,
    val createdAt: Instant, val expiresAt: Instant, val consumedAt: Instant?,
    val id: UUID = UUID.randomUUID(), val invalidatedAt: Instant? = null) {
    fun usable(now: Instant) = consumedAt == null && invalidatedAt == null && now.isBefore(expiresAt)
}
data class PairedDevice(val id: UUID, val campaign: UUID, val player: UUID, val credentialHash: String,
    val createdAt: Instant, val lastSeenAt: Instant, val revokedAt: Instant?)
