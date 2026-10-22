package workbench.preparation.adapter.web

import arrow.core.Either
import org.springframework.stereotype.Component
import tools.jackson.core.StreamReadFeature
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import workbench.platform.api.Failure
import workbench.preparation.api.Archive
import java.util.UUID

/** Version-specific wire validation happens before binding and before any database writes. */
@Component
class SessionArchiveReader(private val mapper: ObjectMapper) : workbench.preparation.application.SessionArchiveCodec {
    override fun write(archive: Archive): ByteArray {
        val out = object : java.io.ByteArrayOutputStream() {
            override fun write(b: Int) { require(count < MAX_ARCHIVE); super.write(b) }
            override fun write(b: ByteArray, off: Int, len: Int) { require(count.toLong() + len <= MAX_ARCHIVE); super.write(b, off, len) }
        }
        mapper.writeValue(out, archive)
        return out.toByteArray()
    }
    override fun readIllustrated(bytes: ByteArray): Either<Failure, Archive> = try {
        require(bytes.size <= MAX_ARCHIVE)
        val tree = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes)
        require(tree.path("version").isIntegralNumber && tree.path("version").intValue() == 5)
        val images = mutableListOf<workbench.platform.api.ImageMetadata?>()
        val legacy = mapper.readTree(mapper.writeValueAsBytes(tree)) as tools.jackson.databind.node.ObjectNode
        legacy.put("version", 4)
        for (session in legacy.path("sessions")) for (item in session.path("items")) {
            val image = item.path("image")
            if (!image.isMissingNode) {
                fields(image, "hash", "mime", "width", "height", "bytes")
                strings(image, "hash", "mime"); listOf("width", "height", "bytes").forEach { integer(image.path(it)) }
                images += mapper.treeToValue(image, workbench.platform.api.ImageMetadata::class.java)
                (item as tools.jackson.databind.node.ObjectNode).remove("image")
            } else images += null
        }
        read(mapper.writeValueAsBytes(legacy)).map { archive ->
            var at = 0
            archive.copy(version = 5, sessions = archive.sessions.map { s -> s.copy(items = s.items.map { it.copy(image = images[at++]) }) })
        }
    } catch (_: Exception) { Either.Left(Failure.Invalid("preparation.archive-format", "Invalid illustrated session manifest. No sessions imported.")) }

    override fun read(bytes: ByteArray): Either<Failure, Archive> = try {
        require(bytes.size <= MAX_ARCHIVE)
        val tree = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes)
        fields(tree, "version", "sessions")
        integer(tree.path("version"))
        val version = tree.path("version").intValue()
        require(version in setOf(1, 2, 3, 4))
        val sessions = tree.path("sessions")
        require(sessions.isArray && sessions.size() in 1..100)
        var count = 0
        for (session in sessions) {
            val sessionFields = arrayOf("id", "campaign", "revision", "title", "objective", "notes", "items")
            if (version == 4) {
                fields(session, *sessionFields, "table")
                val table = session.path("table")
                if (!table.isNull) {
                    fields(table, "active", "used")
                    for (name in listOf("active", "used")) {
                        require(table.path(name).isArray && table.path(name).size() <= 1000)
                        table.path(name).forEach(::uuid)
                    }
                }
            } else fields(session, *sessionFields)
            uuid(session.path("id")); uuid(session.path("campaign"))
            val revision = session.path("revision")
            require(revision.isIntegralNumber && revision.canConvertToLong() && revision.longValue() >= 0)
            strings(session, "title", "objective", "notes")
            val items = session.path("items")
            require(items.isArray)
            count += items.size(); require(count <= 1000)
            for (item in items) {
                val names = arrayOf("id", "title", "markdown", "provenance", "anchors", "notes")
                if (version == 1) fields(item, *names) else fields(item, *names, "capturedSource")
                uuid(item.path("id")); strings(item, "title", "markdown", "notes")
                val anchors = item.path("anchors")
                require(anchors.isObject)
                anchors.properties().forEach { string(it.value); require(it.key.toByteArray(Charsets.UTF_8).size <= MAX_TEXT) }
                val p = item.path("provenance")
                val provenanceFields = arrayOf("campaign", "capture", "path", "section", "documentHash", "contentHash")
                if (version >= 3) fields(p, *provenanceFields, "kind", "authored") else fields(p, *provenanceFields)
                uuid(p.path("campaign"))
                if (version >= 3 && p.path("kind").asString() == "authored") {
                    require(p.path("capture").isNull)
                    authored(p.path("authored"))
                } else {
                    uuid(p.path("capture"))
                    if (version >= 3) require(p.path("kind").asString() == "source" && p.path("authored").isNull)
                }
                strings(p, "path", "documentHash", "contentHash")
                nullableString(p.path("section"))
                if (version >= 2 && !item.path("capturedSource").isNull) captured(item.path("capturedSource"))
            }
        }
        Either.Right(mapper.treeToValue(tree, Archive::class.java))
    } catch (_: Exception) { Either.Left(Failure.Invalid("preparation.archive-format", "Invalid or unsupported session archive. No sessions imported.")) }

    private fun authored(node: JsonNode) {
        fields(node, "draft", "card", "revision", "approval", "approvedAt", "original", "originalHash", "originalCampaign", "originalCapture", "originalPath", "links")
        listOf("draft", "card", "approval").forEach { uuid(node.path(it)) }
        require(node.path("revision").isIntegralNumber && node.path("revision").canConvertToLong() && node.path("revision").longValue() >= 0)
        strings(node, "approvedAt")
        listOf("original", "originalHash", "originalPath").forEach { nullableString(node.path(it)) }
        listOf("originalCampaign", "originalCapture").forEach { if (!node.path(it).isNull) uuid(node.path(it)) }
        require(node.path("links").isArray)
        for (link in node.path("links")) {
            fields(link, "destination", "kind", "path", "anchor", "section", "capture", "draft", "revision")
            strings(link, "destination", "kind")
            listOf("path", "anchor", "section").forEach { nullableString(link.path(it)) }
            listOf("capture", "draft").forEach { if (!link.path(it).isNull) uuid(link.path(it)) }
            val revision = link.path("revision")
            require(revision.isNull || (revision.isIntegralNumber && revision.canConvertToLong() && revision.longValue() >= 0))
        }
    }
    private fun captured(node: JsonNode) {
        fields(node, "interpretation", "bodyStart", "classification", "relationships")
        integer(node.path("interpretation")); integer(node.path("bodyStart"))
        classification(node.path("classification"))
        require(node.path("relationships").isArray)
        for (r in node.path("relationships")) {
            fields(r, "key", "originSection", "destination", "target", "classification", "sceneCandidate")
            strings(r, "key", "originSection", "destination")
            require(r.path("sceneCandidate").isBoolean)
            val target = r.path("target")
            fields(target, "document", "section", "external", "missing")
            listOf("document", "section", "external").forEach { nullableString(target.path(it)) }
            require(target.path("missing").isBoolean)
            if (!r.path("classification").isNull) classification(r.path("classification"))
        }
    }
    private fun classification(node: JsonNode) {
        fields(node, "metadata", "issues")
        val metadata = node.path("metadata")
        if (!metadata.isNull) {
            fields(metadata, "schema", "id", "title", "type", "purpose", "status", "tags", "summary")
            integer(metadata.path("schema")); uuid(metadata.path("id"))
            strings(metadata, "title", "type", "purpose", "status"); nullableString(metadata.path("summary"))
            val tags = metadata.path("tags")
            require(tags.isArray && tags.size() <= 32); tags.forEach(::string)
        }
        val issues = node.path("issues")
        require(issues.isArray && issues.size() <= 4096)
        for (issue in issues) {
            fields(issue, "code", "field", "message", "severity")
            strings(issue, "code", "message", "severity"); nullableString(issue.path("field"))
        }
    }
    private fun fields(node: JsonNode, vararg names: String) { require(node.isObject && node.properties().map { it.key }.toSet() == names.toSet()) }
    private fun integer(node: JsonNode) { require(node.isIntegralNumber && node.canConvertToInt()) }
    private fun string(node: JsonNode) { require(node.isString && node.asString().toByteArray(Charsets.UTF_8).size <= MAX_TEXT) }
    private fun strings(node: JsonNode, vararg names: String) { names.forEach { string(node.path(it)) } }
    private fun nullableString(node: JsonNode) { if (!node.isNull) string(node) }
    private fun uuid(node: JsonNode) { string(node); require(UUID.fromString(node.asString()).toString() == node.asString()) }
    companion object {
        const val MAX_ARCHIVE = 20 * 1024 * 1024
        private const val MAX_TEXT = 2 * 1024 * 1024
    }
}
