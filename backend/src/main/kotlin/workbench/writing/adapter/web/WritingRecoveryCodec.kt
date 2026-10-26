package workbench.writing.adapter.web

import org.springframework.stereotype.Component
import tools.jackson.core.StreamReadFeature
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import workbench.writing.api.WritingArchive
import workbench.writing.application.*
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

@Component
class WritingRecoveryCodec(private val mapper: ObjectMapper) : RecoveryCodec {
    override fun read(bytes: ByteArray): WritingArchive = readVersion(bytes, 3)
    override fun readIllustrated(bytes: ByteArray): WritingArchive = readVersion(bytes, 4)
    private fun readVersion(bytes: ByteArray, version: Int): WritingArchive {
        require(bytes.size <= RECOVERY_BYTES)
        Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes))
        val tree = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes)
        require(tree.path("drafts").isArray && tree.path("drafts").size() <= 1000)
        require(tree.path("approved").isArray && tree.path("exports").isArray && tree.path("approved").size() + tree.path("exports").size() <= 10000)
        require(tree.path("associations").isArray && tree.path("associations").size() <= 10000 &&
            tree.path("approved").size() + tree.path("exports").size() + tree.path("associations").size() <= 10000)
        val incomingVersion = tree.path("version")
        require(incomingVersion.isIntegralNumber && incomingVersion.canConvertToInt() && incomingVersion.intValue() in setOf(version, version + 2))
        if (incomingVersion.intValue() == version) {
            val snapshots = mutableListOf<JsonNode>()
            tree.path("drafts").forEach { snapshots.add(it) }
            tree.path("approved").forEach { snapshots.add(it.path("snapshot")) }
            tree.path("exports").forEach { snapshots.add(it.path("snapshot")) }
            for (snapshot in snapshots) {
                require(snapshot.isObject && snapshot.path("fields").isObject && !snapshot.has("encoding") && !snapshot.path("fields").has("backText"))
                (snapshot as tools.jackson.databind.node.ObjectNode).put("encoding", 1)
                (snapshot.path("fields") as tools.jackson.databind.node.ObjectNode).put("backText", "")
            }
        }
        val archive = mapper.treeToValue(tree, WritingArchive::class.java)
        require(archive.version in setOf(version, version + 2))
        if (version == 3) require((archive.drafts + archive.approved.map { it.snapshot } + archive.exports.map { it.snapshot }).all { it.image == null })
        // Round-trip shape comparison rejects unknown/missing fields, scalar coercions, noncanonical UUIDs
        // and nulls supplied for primitive fields; never accepts an entity's incidental schema.
        val mismatches = mutableListOf<String>()
        fun same(a: JsonNode, b: JsonNode, path: String = "archive"): Boolean {
            val valid = when {
                a.isObject && b.isObject -> a.properties().map { it.key }.toSet() == b.properties().map { it.key }.toSet() && a.properties().all { same(it.value, b.path(it.key), "$path.${it.key}") }
                a.isArray && b.isArray -> a.size() == b.size() && (0 until a.size()).all { same(a[it], b[it], "$path[$it]") }
                a.isIntegralNumber && b.isIntegralNumber -> a.asString() == b.asString()
                else -> a == b
            }
            if (!valid && mismatches.size < 3) mismatches += if (a.isObject && b.isObject) "$path (${a.properties().map { it.key }} vs ${b.properties().map { it.key }})" else path
            return valid
        }
        require(same(tree, mapper.valueToTree(archive))) { "Archive shape mismatch at ${mismatches.joinToString()}" }
        return archive
    }
    override fun write(archive: WritingArchive): ByteArray {
        val out = object : ByteArrayOutputStream() {
            override fun write(b: Int) { require(count < RECOVERY_BYTES); super.write(b) }
            override fun write(b: ByteArray, off: Int, len: Int) { require(count.toLong() + len <= RECOVERY_BYTES); super.write(b, off, len) }
        }
        mapper.writeValue(out, archive)
        return out.toByteArray()
    }
}
