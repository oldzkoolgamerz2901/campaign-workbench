package workbench.playthroughs.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.playthroughs.application.*
import java.util.UUID

@Entity
@Table(name = "play_note", schema = "playthroughs")
class PlayNoteEntity(@Id var id: UUID = UUID.randomUUID(), var session: UUID = UUID.randomUUID(),
    var operation: UUID? = null, var state: String = "{}")
interface PlayNoteRepository : JpaRepository<PlayNoteEntity, UUID> {
    fun findBySessionOrderById(session: UUID): List<PlayNoteEntity>
    fun findBySessionAndId(session: UUID, id: UUID): PlayNoteEntity?
    fun findBySessionAndOperation(session: UUID, operation: UUID): PlayNoteEntity?
    fun countBySession(session: UUID): Long
}
@Repository
class JpaPlayNoteStore(private val repository: PlayNoteRepository, private val mapper: ObjectMapper) : PlayNoteStore {
    private fun PlayNoteEntity.record() = mapper.readValue(state, StoredPlayNote::class.java)
    override fun list(session: UUID) = repository.findBySessionOrderById(session).map { it.record() }
    override fun get(session: UUID, id: UUID) = repository.findBySessionAndId(session, id)?.record()
    override fun operation(session: UUID, operation: UUID) = repository.findBySessionAndOperation(session, operation)?.record()
    override fun count(session: UUID) = repository.countBySession(session)
    override fun put(record: StoredPlayNote) {
        repository.saveAndFlush(PlayNoteEntity(record.note.id, record.note.session, record.operation, mapper.writeValueAsString(record)))
    }
}
