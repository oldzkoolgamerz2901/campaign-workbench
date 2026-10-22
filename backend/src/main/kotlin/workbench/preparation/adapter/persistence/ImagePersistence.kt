package workbench.preparation.adapter.persistence

import java.util.UUID
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import workbench.preparation.application.*
import workbench.platform.api.*

@Repository
class JdbcPreparationImageStore(private val jdbc: JdbcTemplate) : PreparationImageStore {
    private fun kind(owner: UUID) = "campaign"
    private fun id(owner: UUID) = owner
    @Transactional
    override fun put(owner: UUID, image: ProcessedImage) {
        val m = image.metadata
        jdbc.update("""INSERT INTO preparation.image_original(owner_kind,owner_id,hash,mime,width,height,byte_count,content)
            VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING""", kind(owner), id(owner), m.hash, m.mime, m.width, m.height, m.bytes, image.original.copy())
        // Serialize same-scope writers before checking immutable variants.
        jdbc.queryForObject("SELECT hash FROM preparation.image_original WHERE owner_kind=? AND owner_id=? AND hash=? FOR UPDATE", String::class.java, kind(owner), id(owner), m.hash)
        check(metadata(owner, m.hash) == m && original(owner, m.hash)!!.copy().contentEquals(image.original.copy())) { "Immutable image differs from stored content." }
        image.derivatives.forEach { d ->
            jdbc.update("""INSERT INTO preparation.image_derivative(owner_kind,owner_id,hash,policy,variant,mime,width,height,content_hash,content)
                VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING""", kind(owner), id(owner), m.hash, d.policy, d.variant.name, d.mime, d.width, d.height, d.content.sha256, d.content.copy())
            val stored = derivative(owner, m.hash, d.policy, d.variant)!!
            check(stored.mime == d.mime && stored.width == d.width && stored.height == d.height && stored.content.copy().contentEquals(d.content.copy())) { "Immutable derivative differs from stored content." }
        }
    }
    @Transactional
    override fun prune(owner: UUID) {

        // Called only after references are durably flushed within the owning write transaction.
        val retained = jdbc.queryForList("""SELECT i.image_hash FROM preparation.item i JOIN preparation.session s ON s.id=i.session_id WHERE s.campaign=? AND i.image_hash IS NOT NULL""", String::class.java, owner).toSet()
        val hashes = jdbc.queryForList("SELECT hash FROM preparation.image_original WHERE owner_kind=? AND owner_id=?", String::class.java, kind(owner), id(owner))
        hashes.filter { it !in retained }.forEach { hash ->
            jdbc.update("DELETE FROM preparation.image_derivative WHERE owner_kind=? AND owner_id=? AND hash=?", kind(owner), id(owner), hash)
            jdbc.update("DELETE FROM preparation.image_original WHERE owner_kind=? AND owner_id=? AND hash=?", kind(owner), id(owner), hash)
        }
    }
    override fun metadata(owner: UUID, hash: String) = jdbc.query(
        "SELECT hash,mime,width,height,byte_count FROM preparation.image_original WHERE owner_kind=? AND owner_id=? AND hash=?",
        { r, _ -> ImageMetadata(r.getString("hash"), r.getString("mime"), r.getInt("width"), r.getInt("height"), r.getInt("byte_count")) }, kind(owner), id(owner), hash).singleOrNull()
    override fun original(owner: UUID, hash: String) = jdbc.query(
        "SELECT content FROM preparation.image_original WHERE owner_kind=? AND owner_id=? AND hash=?",
        { r, _ -> ImageBytes(r.getBytes(1)).also { check(it.sha256 == hash) } }, kind(owner), id(owner), hash).singleOrNull()
    override fun derivative(owner: UUID, hash: String, policy: Int, variant: ImageVariant) = jdbc.query(
        "SELECT mime,width,height,content_hash,content FROM preparation.image_derivative WHERE owner_kind=? AND owner_id=? AND hash=? AND policy=? AND variant=?",
        { r, _ -> ImageDerivative(policy, variant, r.getString("mime"), r.getInt("width"), r.getInt("height"), ImageBytes(r.getBytes("content")).also { check(it.sha256 == r.getString("content_hash")) }) },
        kind(owner), id(owner), hash, policy, variant.name).singleOrNull()
}
