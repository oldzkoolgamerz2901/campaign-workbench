package workbench.sharing.api

import arrow.core.Either
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.*
import workbench.sources.api.CardLayout
import java.util.UUID

data class PreviewSharedCard(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val item: UUID)
data class SharedCardPreview(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fingerprint: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val visible: SharedCardContent,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val artwork: Boolean, val detailsImage: Boolean = false)
enum class SharingMode { HANDOUT, INVENTORY }
data class DistributeCard(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val operation: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val item: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fingerprint: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val mode: SharingMode,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val recipient: UUID?,
    val pile: UUID? = null, val newPile: String? = null, val revealBack: Boolean = false)
data class SharedCardData(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val visible: SharedCardContent,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val mode: SharingMode,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val artwork: Boolean,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val pile: UUID? = null,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val backRevealed: Boolean = true, val detailsImage: Boolean = false)
data class SharedCollection(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val cards: List<SharedCardData>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val piles: List<SharedPile> = emptyList())
data class PlayerCollections(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val identity: PlayerIdentity,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val group: SharedCollection,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val mine: SharedCollection)

interface PlayerCards {
    fun collections(campaign: UUID, credential: String?): Either<Failure, PlayerCollections>
    fun artwork(campaign: UUID, credential: String?, card: UUID): Either<Failure, ImageDerivative>
    fun detailsImage(campaign: UUID, credential: String?, card: UUID): Either<Failure, ImageDerivative>
    fun layout(campaign: UUID, credential: String?, card: UUID): Either<Failure, CardLayout>
}


data class TransferSharedCard(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val recipient: UUID?, val pile: UUID? = null)
data class RemovedSharedCard(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val card: SharedCardData,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val recipient: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val state: String)
data class RemovedSharedCards(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val cards: List<RemovedSharedCard>)
interface PlayerCardCommands {
    fun claim(campaign: UUID, credential: String?, card: UUID): Either<Failure, SharedCardData>
    fun remove(campaign: UUID, credential: String?, card: UUID): Either<Failure, SharedCardData>
}
