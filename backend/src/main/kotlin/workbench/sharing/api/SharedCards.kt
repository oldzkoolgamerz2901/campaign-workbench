package workbench.sharing.api

import arrow.core.Either
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.*
import workbench.sources.api.CardLayout
import workbench.sources.api.CardLayoutInput
import java.util.UUID

data class PreviewSharedCard(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val item: UUID)
data class SharedCardPreview(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fingerprint: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val visible: CardLayoutInput,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val artwork: Boolean)
enum class SharingMode { HANDOUT, INVENTORY }
data class DistributeCard(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val operation: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val item: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fingerprint: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val mode: SharingMode,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val recipient: UUID?)
data class SharedCardData(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val visible: CardLayoutInput,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val mode: SharingMode,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val artwork: Boolean)
data class SharedCollection(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val cards: List<SharedCardData>)
data class PlayerCollections(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val identity: PlayerIdentity,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val group: SharedCollection,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val mine: SharedCollection)

interface PlayerCards {
    fun collections(campaign: UUID, credential: String?): Either<Failure, PlayerCollections>
    fun artwork(campaign: UUID, credential: String?, card: UUID): Either<Failure, ImageDerivative>
    fun layout(campaign: UUID, credential: String?, card: UUID): Either<Failure, CardLayout>
}
