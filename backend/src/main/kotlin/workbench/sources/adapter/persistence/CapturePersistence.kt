package workbench.sources.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import workbench.sources.domain.Capture
import workbench.sources.application.CaptureStore
import java.util.UUID

@Entity
@Table(name = "capture", schema = "sources")
class CaptureEntity(
    @Id var campaign: UUID = UUID.randomUUID(),
    @Column(name = "capture_id") var captureId: UUID = UUID.randomUUID(),
    var revision: Long = 0,
    @ElementCollection
    @CollectionTable(name = "document", schema = "sources", joinColumns = [JoinColumn(name = "campaign")])
    @MapKeyColumn(name = "path") @Column(name = "content")
    var documents: MutableMap<String, String> = mutableMapOf(),
)
interface CaptureRepository : JpaRepository<CaptureEntity, UUID>
@Repository
class JpaCaptureStore(private val repository: CaptureRepository) : CaptureStore {
    override fun get(campaign: UUID) = repository.findById(campaign).orElse(null)?.let {
        Capture(it.campaign, it.captureId, it.revision, it.documents.toMap())
    }
    override fun publish(capture: Capture) {
        val entity = repository.findById(capture.campaign).orElseGet { CaptureEntity(campaign = capture.campaign) }
        entity.captureId = capture.id; entity.revision = capture.revision
        entity.documents.clear(); entity.documents.putAll(capture.documents)
        repository.saveAndFlush(entity)
    }
}
