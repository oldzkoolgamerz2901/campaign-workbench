package workbench.sessionarchives.api

import io.swagger.v3.oas.annotations.media.Schema
import workbench.preparation.api.SessionData
import workbench.playthroughs.api.WorkspaceData
import java.util.UUID

data class ArchivedWorkspace(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val workspace: WorkspaceData?
)
data class SessionTransfer(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val version: Int,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val sessions: List<SessionData>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val workspaces: List<ArchivedWorkspace>
)
