package workbench.playthroughs.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.playthroughs.application.*
import java.util.UUID
import java.time.Instant
import workbench.playthroughs.api.ResourceReference

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
class JpaPlayNoteStore(private val repository: PlayNoteRepository, private val mapper: ObjectMapper, private val em: EntityManager) : PlayNoteStore {
    private fun PlayNoteEntity.record() = mapper.readValue(state, StoredPlayNote::class.java)
    override fun history(campaign: UUID, reference: ResourceReference, scene: Boolean, pinnedOnly: Boolean,
        limit: Int, beforeTime: Instant?, beforeId: UUID?): List<StoredPlayNote> {
        // Only these two fixed JSON paths can enter SQL. All caller values are bound.
        val dimension = if (scene) "scene" else "resource"
        val time = "playthroughs.note_time(state::jsonb #>> '{note,createdAt}')"
        val cursor = if (beforeTime != null) "AND ($time, id) < (playthroughs.note_time(:beforeTime), CAST(:beforeId AS uuid))" else ""
        val pins = if (pinnedOnly) "AND state::jsonb #>> '{note,pinned}' = 'true'" else ""
        val query = em.createNativeQuery("""
            SELECT state FROM playthroughs.play_note
            WHERE state::jsonb #>> '{note,campaign}' = :campaign
              AND state::jsonb #>> '{note,$dimension,reference,campaign}' = :origin
              AND state::jsonb #>> '{note,$dimension,reference,card}' = :card
              $cursor $pins
            ORDER BY $time DESC, id DESC
        """).setParameter("campaign", campaign.toString()).setParameter("origin", reference.campaign.toString())
            .setParameter("card", reference.card.toString()).setMaxResults(limit)
        if (beforeTime != null) query.setParameter("beforeTime", beforeTime.toString()).setParameter("beforeId", beforeId.toString())
        return query.resultList.map { mapper.readValue(it as String, StoredPlayNote::class.java) }
    }
    override fun list(session: UUID) = repository.findBySessionOrderById(session).map { it.record() }
    override fun get(session: UUID, id: UUID) = repository.findBySessionAndId(session, id)?.record()
    override fun operation(session: UUID, operation: UUID) = repository.findBySessionAndOperation(session, operation)?.record()
    override fun count(session: UUID) = repository.countBySession(session)
    override fun put(record: StoredPlayNote) {
        repository.saveAndFlush(PlayNoteEntity(record.note.id, record.note.session, record.operation, mapper.writeValueAsString(record)))
    }
}
