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
    override fun read(bytes: ByteArray): WritingArchive = readVersion(bytes, 1)
    override fun readIllustrated(bytes: ByteArray): WritingArchive = readVersion(bytes, 2)
    private fun readVersion(bytes: ByteArray, version: Int): WritingArchive {
        require(bytes.size <= RECOVERY_BYTES)
        Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes))
        val tree = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes)
        require(tree.path("drafts").isArray && tree.path("drafts").size() <= 1000)
        require(tree.path("approved").isArray && tree.path("exports").isArray && tree.path("approved").size() + tree.path("exports").size() <= 10000)
        val archive = mapper.treeToValue(tree, WritingArchive::class.java)
        require(archive.version == version)
        if (version == 1) require((archive.drafts + archive.approved.map { it.snapshot } + archive.exports.map { it.snapshot }).all { it.image == null })
        // Round-trip shape comparison rejects unknown/missing fields, scalar coercions, noncanonical UUIDs
        // and nulls supplied for primitive fields; never accepts an entity's incidental schema.
        fun same(a: JsonNode, b: JsonNode): Boolean = when {
            a.isObject && b.isObject -> a.properties().map { it.key }.toSet() == b.properties().map { it.key }.toSet() && a.properties().all { same(it.value, b.path(it.key)) }
            a.isArray && b.isArray -> a.size() == b.size() && (0 until a.size()).all { same(a[it], b[it]) }
            a.isIntegralNumber && b.isIntegralNumber -> a.asString() == b.asString()
            else -> a == b
        }
        require(same(tree, mapper.valueToTree(archive)))
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
