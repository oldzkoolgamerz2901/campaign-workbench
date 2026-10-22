package workbench.writing.adapter.persistence

import java.util.UUID
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import workbench.writing.application.*
import workbench.platform.api.*

@Repository
class JdbcWritingImageStore(private val jdbc: JdbcTemplate) : WritingImageStore {
    private fun kind(owner: WritingImageOwner) = if (owner is WritingImageOwner.Campaign) "campaign" else "recovery"
    private fun id(owner: WritingImageOwner) = owner.id
    @Transactional
    override fun put(owner: WritingImageOwner, image: ProcessedImage) {
        val m = image.metadata
        jdbc.update("""INSERT INTO writing.image_original(owner_kind,owner_id,hash,mime,width,height,byte_count,content)
            VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING""", kind(owner), id(owner), m.hash, m.mime, m.width, m.height, m.bytes, image.original.copy())
        // Serialize same-scope writers before checking immutable variants.
        jdbc.queryForObject("SELECT hash FROM writing.image_original WHERE owner_kind=? AND owner_id=? AND hash=? FOR UPDATE", String::class.java, kind(owner), id(owner), m.hash)
        check(metadata(owner, m.hash) == m && original(owner, m.hash)!!.copy().contentEquals(image.original.copy())) { "Immutable image differs from stored content." }
        image.derivatives.forEach { d ->
            jdbc.update("""INSERT INTO writing.image_derivative(owner_kind,owner_id,hash,policy,variant,mime,width,height,content_hash,content)
                VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING""", kind(owner), id(owner), m.hash, d.policy, d.variant.name, d.mime, d.width, d.height, d.content.sha256, d.content.copy())
            val stored = derivative(owner, m.hash, d.policy, d.variant)!!
            check(stored.mime == d.mime && stored.width == d.width && stored.height == d.height && stored.content.copy().contentEquals(d.content.copy())) { "Immutable derivative differs from stored content." }
        }
    }
    @Transactional
    override fun prune(owner: WritingImageOwner) {
        if (owner !is WritingImageOwner.Campaign) return
        // Called only after references are durably flushed within the owning write transaction.
        val retained = jdbc.queryForList("""SELECT image_hash FROM writing.draft WHERE campaign=? AND image_hash IS NOT NULL
                UNION SELECT image_hash FROM writing.approved_revision WHERE campaign=? AND image_hash IS NOT NULL
                UNION SELECT image_hash FROM writing.export_artifact WHERE campaign=? AND image_hash IS NOT NULL""", String::class.java, id(owner), id(owner), id(owner)).toSet()
        val hashes = jdbc.queryForList("SELECT hash FROM writing.image_original WHERE owner_kind=? AND owner_id=?", String::class.java, kind(owner), id(owner))
        hashes.filter { it !in retained }.forEach { hash ->
            jdbc.update("DELETE FROM writing.image_derivative WHERE owner_kind=? AND owner_id=? AND hash=?", kind(owner), id(owner), hash)
            jdbc.update("DELETE FROM writing.image_original WHERE owner_kind=? AND owner_id=? AND hash=?", kind(owner), id(owner), hash)
        }
    }
    override fun metadata(owner: WritingImageOwner, hash: String) = jdbc.query(
        "SELECT hash,mime,width,height,byte_count FROM writing.image_original WHERE owner_kind=? AND owner_id=? AND hash=?",
        { r, _ -> ImageMetadata(r.getString("hash"), r.getString("mime"), r.getInt("width"), r.getInt("height"), r.getInt("byte_count")) }, kind(owner), id(owner), hash).singleOrNull()
    override fun original(owner: WritingImageOwner, hash: String) = jdbc.query(
        "SELECT content FROM writing.image_original WHERE owner_kind=? AND owner_id=? AND hash=?",
        { r, _ -> ImageBytes(r.getBytes(1)).also { check(it.sha256 == hash) } }, kind(owner), id(owner), hash).singleOrNull()
    override fun derivative(owner: WritingImageOwner, hash: String, policy: Int, variant: ImageVariant) = jdbc.query(
        "SELECT mime,width,height,content_hash,content FROM writing.image_derivative WHERE owner_kind=? AND owner_id=? AND hash=? AND policy=? AND variant=?",
        { r, _ -> ImageDerivative(policy, variant, r.getString("mime"), r.getInt("width"), r.getInt("height"), ImageBytes(r.getBytes("content")).also { check(it.sha256 == r.getString("content_hash")) }) },
        kind(owner), id(owner), hash, policy, variant.name).singleOrNull()
}
