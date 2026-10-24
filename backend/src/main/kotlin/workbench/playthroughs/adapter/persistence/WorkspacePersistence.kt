package workbench.playthroughs.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.playthroughs.application.WorkspaceStore
import workbench.playthroughs.domain.PlayWorkspace
import java.util.UUID

@Entity
@Table(name = "tabletop_workspace", schema = "playthroughs")
class WorkspaceEntity(@Id var session: UUID = UUID.randomUUID(), var revision: Long = 0, var state: String = "{}")
interface WorkspaceRepository : JpaRepository<WorkspaceEntity, UUID>
@Repository
class JpaWorkspaceStore(private val repository: WorkspaceRepository, private val mapper: ObjectMapper) : WorkspaceStore {
    override fun get(session: UUID) = repository.findById(session).orElse(null)?.let { mapper.readValue(it.state, PlayWorkspace::class.java) }
    override fun put(workspace: PlayWorkspace) {
        repository.saveAndFlush(WorkspaceEntity(workspace.session, workspace.revision, mapper.writeValueAsString(workspace)))
    }
}
