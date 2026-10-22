package workbench.playthroughs.api

import arrow.core.Either
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.Failure
import java.util.UUID

data class WorkspaceData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val active: List<UUID>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val used: List<UUID>
)
data class SaveWorkspace(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val active: List<UUID>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val used: List<UUID>
)
interface Playthroughs {
    fun open(campaign: UUID, session: UUID): Either<Failure, WorkspaceData>
    fun save(campaign: UUID, session: UUID, request: SaveWorkspace): Either<Failure, WorkspaceData>
}
interface WorkspaceTransfers {
    /** Reconcile if initialized, but never initialize an unopened workspace just to export it. */
    fun snapshot(campaign: UUID, session: UUID): Either<Failure, WorkspaceData?>
    fun restore(campaign: UUID, session: UUID, workspace: WorkspaceData?): Either<Failure, Unit>
}
