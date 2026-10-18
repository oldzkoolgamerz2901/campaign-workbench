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
class SessionArchiveReader(private val mapper: ObjectMapper) {
    fun read(bytes: ByteArray): Either<Failure, Archive> = try {
        require(bytes.size <= MAX_ARCHIVE)
        val tree = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes)
        fields(tree, "version", "sessions")
        integer(tree.path("version"))
        val version = tree.path("version").intValue()
        require(version in setOf(1, 2))
        val sessions = tree.path("sessions")
        require(sessions.isArray && sessions.size() in 1..100)
        var count = 0
        for (session in sessions) {
            fields(session, "id", "campaign", "revision", "title", "objective", "notes", "items")
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
                fields(p, "campaign", "capture", "path", "section", "documentHash", "contentHash")
                uuid(p.path("campaign")); uuid(p.path("capture")); strings(p, "path", "documentHash", "contentHash")
                nullableString(p.path("section"))
                if (version == 2 && !item.path("capturedSource").isNull) captured(item.path("capturedSource"))
            }
        }
        Either.Right(mapper.treeToValue(tree, Archive::class.java))
    } catch (_: Exception) { Either.Left(Failure.Invalid("preparation.archive-format", "Invalid or unsupported session archive. No sessions imported.")) }

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
