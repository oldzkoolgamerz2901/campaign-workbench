package workbench.playthroughs.api

import arrow.core.Either
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.Failure
import java.util.UUID

enum class CardLocation { SESSION_CARDS, PILE_1, PILE_2, USED }
enum class PileSlot { PILE_1, PILE_2 }

data class PileData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val name: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val items: List<UUID>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val cover: UUID?
)
data class WorkspaceData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val sessionCards: List<UUID>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val used: List<UUID>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val activeSceneItemId: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val pile1: PileData,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val pile2: PileData
)
data class MoveCard(
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val item: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val destination: CardLocation,
    val index: Int? = null
)
data class ReorderCards(
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val location: CardLocation,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val items: List<UUID>
)
data class ChooseCover(
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val pile: PileSlot,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val item: UUID
)
data class RenamePile(
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val pile: PileSlot,
    @param:JsonProperty(value = "name", required = true)
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true, maxLength = 200) val name: String?
)
data class SceneMovement(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val item: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val destination: CardLocation,
    val index: Int? = null
)
data class TransitionScene(
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val preparationRevision: Long,
    @param:JsonProperty(value = "scene", required = true)
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val scene: UUID?,
    val movements: List<SceneMovement> = emptyList()
)
data class SceneOverview(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val workspace: WorkspaceData,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val preparationRevision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val scene: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val relatedItemIds: List<UUID>
)
data class RelationshipSuggestion(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val key: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val destination: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val state: workbench.preparation.api.PreparedTargetState,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val candidates: List<workbench.preparation.api.PreparedTarget>
)
data class RelationshipSuggestions(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val scene: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val suggestions: List<RelationshipSuggestion>
)
interface Playthroughs {
    fun suggestions(campaign: UUID, session: UUID, scene: UUID): Either<Failure, RelationshipSuggestions>
    fun open(campaign: UUID, session: UUID): Either<Failure, WorkspaceData>
    fun overview(campaign: UUID, session: UUID, scene: UUID): Either<Failure, SceneOverview>
    fun move(campaign: UUID, session: UUID, request: MoveCard): Either<Failure, WorkspaceData>
    fun reorder(campaign: UUID, session: UUID, request: ReorderCards): Either<Failure, WorkspaceData>
    fun cover(campaign: UUID, session: UUID, request: ChooseCover): Either<Failure, WorkspaceData>
    fun rename(campaign: UUID, session: UUID, request: RenamePile): Either<Failure, WorkspaceData>
    fun transition(campaign: UUID, session: UUID, request: TransitionScene): Either<Failure, WorkspaceData>
}
interface WorkspaceTransfers {
    fun snapshot(campaign: UUID, session: UUID): Either<Failure, WorkspaceData?>
    fun restore(campaign: UUID, session: UUID, workspace: WorkspaceData?): Either<Failure, Unit>
    /** Shared invariant validation for archive composition, without repository access. */
    fun validate(workspace: WorkspaceData, membership: List<UUID>, scenes: Set<UUID>): Boolean
}
