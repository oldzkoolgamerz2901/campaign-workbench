package workbench.sharing.api

import arrow.core.Either
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.Failure
import java.util.UUID

data class CampaignPlayerData(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val displayName: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val active: Boolean, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val pairedDevices: Int = 0)
data class CampaignPlayers(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val players: List<CampaignPlayerData>)
data class AddCampaignPlayer(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val displayName: String)
data class SetCampaignPlayerActive(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val active: Boolean)
data class DeviceData(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val player: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val createdAt: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val lastSeenAt: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val revokedAt: String?)
data class PlayerDevices(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val devices: List<DeviceData>)
data class RenameCampaignPlayer(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val displayName: String)
data class PairingStatus(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val state: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val expiresAt: String)
data class PairingInvitationData(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val token: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val expiresAt: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID)
data class RedeemPairing(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val token: String)
data class PlayerIdentity(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val player: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val device: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val displayName: String)
data class PairingResult(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val credential: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val identity: PlayerIdentity)

/** Identity rules only. The inbound adapter supplies a trusted admitted campaign, never a client ID. */
interface PlayerAccess {
    fun redeem(campaign: UUID, token: String): Either<Failure, PairingResult>
    fun identify(campaign: UUID, credential: String?): Either<Failure, PlayerIdentity>
}
