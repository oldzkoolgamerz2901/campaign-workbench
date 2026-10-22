package workbench.playthroughs.application

import java.util.UUID
import workbench.playthroughs.domain.PlayWorkspace

interface WorkspaceStore {
    fun get(session: UUID): PlayWorkspace?
    fun put(workspace: PlayWorkspace)
}
