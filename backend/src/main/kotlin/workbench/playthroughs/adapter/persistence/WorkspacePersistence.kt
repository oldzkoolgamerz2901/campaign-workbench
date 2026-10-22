package workbench.playthroughs.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.playthroughs.application.WorkspaceStore
import workbench.playthroughs.domain.PlayWorkspace
import java.util.UUID

@Entity
@Table(name = "workspace", schema = "playthroughs")
class WorkspaceEntity(@Id var session: UUID = UUID.randomUUID(), var revision: Long = 0, var active: String = "[]", var used: String = "[]")
interface WorkspaceRepository : JpaRepository<WorkspaceEntity, UUID>
@Repository
class JpaWorkspaceStore(private val repository: WorkspaceRepository, private val mapper: ObjectMapper) : WorkspaceStore {
    private fun ids(json: String) = mapper.readValue(json, Array<UUID>::class.java).toList()
    override fun get(session: UUID) = repository.findById(session).orElse(null)?.let { PlayWorkspace(it.session, it.revision, ids(it.active), ids(it.used)) }
    override fun put(workspace: PlayWorkspace) {
        repository.saveAndFlush(WorkspaceEntity(workspace.session, workspace.revision, mapper.writeValueAsString(workspace.active), mapper.writeValueAsString(workspace.used)))
    }
}
