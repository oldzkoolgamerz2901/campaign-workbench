package workbench.writing.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.writing.api.ApprovedDraft
import workbench.writing.application.ApprovedRevisionStore
import java.util.UUID

@Entity
@Table(name = "approved_revision", schema = "writing")
class ApprovedRevisionEntity(@Id var id: UUID = UUID.randomUUID(), var campaign: UUID = UUID.randomUUID(),
    var draft: UUID = UUID.randomUUID(), var revision: Long = 0, var payload: String = "", @Column(name = "image_hash") var imageHash: String? = null)
interface ApprovedRevisionRepository : JpaRepository<ApprovedRevisionEntity, UUID> {
    fun findByCampaignAndDraftAndRevision(campaign: UUID, draft: UUID, revision: Long): ApprovedRevisionEntity?
}
@Repository
class JpaApprovedRevisionStore(private val repository: ApprovedRevisionRepository, private val mapper: ObjectMapper) : ApprovedRevisionStore {
    override fun get(campaign: UUID, draft: UUID, revision: Long) = repository.findByCampaignAndDraftAndRevision(campaign, draft, revision)?.let { mapper.readValue(it.payload, ApprovedDraft::class.java) }
    override fun put(value: ApprovedDraft) {
        val d = value.snapshot
        check(get(d.campaign, d.id, d.revision) == null)
        repository.saveAndFlush(ApprovedRevisionEntity(campaign = d.campaign, draft = d.id, revision = d.revision, payload = mapper.writeValueAsString(value), imageHash = d.image?.hash))
    }
}
