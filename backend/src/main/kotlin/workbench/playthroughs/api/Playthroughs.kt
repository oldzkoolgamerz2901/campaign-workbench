package workbench.playthroughs.api

import arrow.core.Either
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.Failure
import java.util.UUID

data class WorkspaceData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val active: List<UUID>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val used: List<UUID>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val activeSceneItemId: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val focusedItemIds: List<UUID>
)
data class SaveWorkspace(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val active: List<UUID>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val used: List<UUID>,
    @param:JsonProperty(value = "activeSceneItemId", required = true)
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val activeSceneItemId: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val focusedItemIds: List<UUID>
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
    fun save(campaign: UUID, session: UUID, request: SaveWorkspace): Either<Failure, WorkspaceData>
}
interface WorkspaceTransfers {
    /** Reconcile if initialized, but never initialize an unopened workspace just to export it. */
    fun snapshot(campaign: UUID, session: UUID): Either<Failure, WorkspaceData?>
    fun restore(campaign: UUID, session: UUID, workspace: WorkspaceData?): Either<Failure, Unit>
}
