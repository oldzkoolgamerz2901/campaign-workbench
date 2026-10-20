package workbench.writing.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.writing.domain.Draft
import workbench.writing.domain.DraftOrigin
import workbench.writing.domain.RecoveryOrigin
import workbench.writing.application.DraftStore
import java.util.UUID

@Entity
@Table(name = "draft", schema = "writing")
class DraftEntity(
    @Id var id: UUID = UUID.randomUUID(), var campaign: UUID = UUID.randomUUID(), var card: UUID = UUID.randomUUID(), var revision: Long = 0,
    var title: String = "", var type: String = "", var status: String = "draft", var tags: String = "[]", var summary: String = "", var body: String = "", var path: String = "", var origin: String? = null, var recovery: String? = null
)
interface DraftRepository : JpaRepository<DraftEntity, UUID> {
    fun findAllByCampaign(campaign: UUID): List<DraftEntity>
    fun findByCampaignAndId(campaign: UUID, id: UUID): DraftEntity?
}
@Repository
class JpaDraftStore(private val repository: DraftRepository, private val mapper: ObjectMapper) : DraftStore {
    private fun model(d: DraftEntity) = Draft(d.id, d.campaign, d.card, d.revision, d.title, d.type, d.status, mapper.readValue(d.tags, Array<String>::class.java).toList(), d.summary, d.body, d.path, d.origin?.let { mapper.readValue(it, DraftOrigin::class.java) }, d.recovery?.let { mapper.readValue(it, RecoveryOrigin::class.java) })
    override fun list(campaign: UUID) = repository.findAllByCampaign(campaign).map(::model).sortedWith(compareBy({ it.title.lowercase() }, { it.id }))
    override fun get(campaign: UUID, id: UUID) = repository.findByCampaignAndId(campaign, id)?.let(::model)
    override fun delete(campaign: UUID, id: UUID) { repository.findByCampaignAndId(campaign, id)?.let { repository.delete(it); repository.flush() } }
    override fun put(draft: Draft) { with(draft) { repository.saveAndFlush(DraftEntity(id, campaign, card, revision, title, type, status, mapper.writeValueAsString(tags), summary, body, path, origin?.let(mapper::writeValueAsString), recovery?.let(mapper::writeValueAsString))) } }
}
