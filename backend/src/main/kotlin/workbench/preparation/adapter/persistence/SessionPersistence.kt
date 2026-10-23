package workbench.preparation.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import workbench.preparation.application.SessionStore
import workbench.preparation.domain.*
import java.util.UUID
import tools.jackson.databind.ObjectMapper

@Entity
@Table(name = "session", schema = "preparation")
class SessionEntity(
    @Id var id: UUID = UUID.randomUUID(), var campaign: UUID = UUID.randomUUID(), var revision: Long = 0,
    var title: String = "", var objective: String = "", var notes: String = "",
    @OneToMany(cascade = [CascadeType.ALL], orphanRemoval = true)
    @JoinColumn(name = "session_id", nullable = false)
    @OrderColumn(name = "position")
    var items: MutableList<ItemEntity> = mutableListOf(),
    @Column(name = "scene_links") var sceneLinks: String = "[]"
)
@Entity
@Table(name = "item", schema = "preparation")
class ItemEntity(
    @Id var id: UUID = UUID.randomUUID(), var title: String = "", var markdown: String = "", var notes: String = "",
    @Column(name = "source_campaign") var sourceCampaign: UUID = UUID.randomUUID(), var capture: UUID? = null,
    var path: String = "", var section: String? = null,
    @Column(name = "document_hash") var documentHash: String = "",
    @Column(name = "content_hash") var contentHash: String = "",
    @ElementCollection
    @CollectionTable(name = "anchor", schema = "preparation", joinColumns = [JoinColumn(name = "item_id")])
    @MapKeyColumn(name = "original_anchor") @Column(name = "local_anchor")
    var anchors: MutableMap<String, String> = mutableMapOf(),
    @Column(name = "captured_source") var capturedSource: String? = null,
    @Column(name = "origin_kind") var originKind: String = "source",
    @Column(name = "authored_origin") var authoredOrigin: String? = null, var image: String? = null, @Column(name = "image_hash") var imageHash: String? = null
)
interface SessionRepository : JpaRepository<SessionEntity, UUID> { fun findByCampaignOrderByTitle(campaign: UUID): List<SessionEntity> }
@Repository
class JpaSessionStore(private val repository: SessionRepository, private val em: EntityManager, private val mapper: ObjectMapper) : SessionStore {
    override fun archiveBytes(campaign: UUID, ids: List<UUID>): Long = (em.createNativeQuery("""
        SELECT coalesce(sum(octet_length(s.title)+octet_length(s.objective)+octet_length(s.notes)+octet_length(s.scene_links)
            + coalesce((SELECT sum(octet_length(i.title)+octet_length(i.markdown)+octet_length(i.notes)+octet_length(i.path)
                + coalesce(octet_length(i.captured_source),0)+coalesce(octet_length(i.authored_origin),0)+coalesce(octet_length(i.image),0)
                + coalesce((SELECT sum(octet_length(a.original_anchor)+octet_length(a.local_anchor)) FROM preparation.anchor a WHERE a.item_id=i.id),0))
              FROM preparation.item i WHERE i.session_id=s.id),0)),0)
        FROM preparation.session s WHERE s.campaign=:campaign AND s.id IN (:ids)
    """, java.lang.Long::class.java).setParameter("campaign", campaign).setParameter("ids", ids).singleResult as Number).toLong()
    private fun model(s: SessionEntity) = Session(s.id, s.campaign, s.revision, s.title, s.objective, s.notes, s.items.map { PreparedItem(it.id, it.title, it.markdown, Provenance(it.sourceCampaign, it.capture, it.path, it.section, it.documentHash, it.contentHash, it.originKind, it.authoredOrigin?.let { json -> mapper.readValue(json, AuthoredOrigin::class.java) }), it.anchors.toMap(), it.notes, it.capturedSource?.let { json -> mapper.readValue(json, CapturedSource::class.java) }, it.image?.let { json -> mapper.readValue(json, workbench.platform.api.ImageMetadata::class.java) }) }, mapper.readValue(s.sceneLinks, Array<SceneLink>::class.java).toList())
    override fun list(campaign: UUID) = repository.findByCampaignOrderByTitle(campaign).map(::model)
    override fun get(campaign: UUID, id: UUID) = repository.findById(id).orElse(null)?.takeIf { it.campaign == campaign }?.let(::model)
    override fun put(session: Session) {
        // Replace ordered rows explicitly so moves cannot violate the unique position constraint mid-flush.
        em.createNativeQuery("DELETE FROM preparation.item WHERE session_id = :id").setParameter("id", session.id).executeUpdate()
        em.flush(); em.clear()
        val entity = repository.findById(session.id).orElseGet { SessionEntity(id = session.id, campaign = session.campaign) }
        entity.revision = session.revision; entity.title = session.title; entity.objective = session.objective; entity.notes = session.notes
        entity.sceneLinks = mapper.writeValueAsString(session.sceneLinks)
        entity.items.clear()
        entity.items.addAll(session.items.map { i -> ItemEntity(i.id, i.title, i.markdown, i.notes, i.provenance.campaign, i.provenance.capture, i.provenance.path, i.provenance.section, i.provenance.documentHash, i.provenance.contentHash, i.anchors.toMutableMap(), i.capturedSource?.let(mapper::writeValueAsString), i.provenance.kind, i.provenance.authored?.let(mapper::writeValueAsString), i.image?.let(mapper::writeValueAsString), i.image?.hash) })
        repository.saveAndFlush(entity)
    }
}
