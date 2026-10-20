package workbench.writing.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.writing.application.ExportStore
import workbench.writing.domain.ExportArtifact
import workbench.writing.domain.ExportEntry
import java.util.UUID

@Entity
@Table(name = "export_artifact", schema = "writing")
class ExportEntity(
    @Id var id: UUID = UUID.randomUUID(), var campaign: UUID = UUID.randomUUID(), var draft: UUID = UUID.randomUUID(),
    var revision: Long = 0, @Column(name = "created_at") var createdAt: String = "", var payload: String = "", var summary: String = ""
)
interface ExportRepository : JpaRepository<ExportEntity, UUID> {
    @Query("select e.summary from ExportEntity e where e.campaign = :campaign and e.draft = :draft order by e.createdAt desc")
    fun summaries(campaign: UUID, draft: UUID): List<String>
    fun findByCampaignAndDraftAndId(campaign: UUID, draft: UUID, id: UUID): ExportEntity?
}
@Repository
class JpaExportStore(private val repository: ExportRepository, private val mapper: ObjectMapper) : ExportStore {
    private fun model(e: ExportEntity) = mapper.readValue(e.payload, ExportArtifact::class.java)
    override fun list(campaign: UUID, draft: UUID) = repository.summaries(campaign, draft).map { mapper.readValue(it, ExportEntry::class.java) }
    override fun get(campaign: UUID, draft: UUID, id: UUID) = repository.findByCampaignAndDraftAndId(campaign, draft, id)?.let(::model)
    override fun put(artifact: ExportArtifact) {
        check(!repository.existsById(artifact.id)) { "Immutable export identity already exists" }
        val entry = ExportEntry(artifact.id, artifact.snapshot.revision, artifact.createdAt, artifact.snapshot.path, artifact.hash, artifact.warnings, artifact.fingerprint, artifact.acknowledged)
        repository.saveAndFlush(ExportEntity(artifact.id, artifact.snapshot.campaign, artifact.snapshot.id, artifact.snapshot.revision, artifact.createdAt, mapper.writeValueAsString(artifact), mapper.writeValueAsString(entry)))
    }
}
