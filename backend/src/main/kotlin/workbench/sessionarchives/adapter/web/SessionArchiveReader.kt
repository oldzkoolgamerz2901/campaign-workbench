package workbench.sessionarchives.adapter.web

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
class SessionArchiveReader(private val mapper: ObjectMapper) : workbench.sessionarchives.application.SessionArchiveCodec {
    override fun writeTransfer(archive: workbench.sessionarchives.api.SessionTransfer): ByteArray = boundedWrite(archive)
    override fun readTransfer(bytes: ByteArray): Either<Failure, workbench.sessionarchives.api.SessionTransfer> = try {
        require(bytes.size <= MAX_ARCHIVE)
        val tree = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes)
        fields(tree, "version", "sessions", "workspaces", "notes")
        integer(tree.path("version")); require(tree.path("version").intValue() in 10..11)
        val notes = tree.path("notes")
        require(notes.isArray && notes.size() <= 10000)
        val counts = mutableMapOf<String, Int>()
        for (note in notes) {
            fields(note, "id", "campaign", "session", "revision", "markdown", "scene", "resource", "createdAt", "updatedAt", "pinned")
            listOf("id", "campaign", "session").forEach { uuid(note.path(it)) }
            val session = note.path("session").asString()
            counts[session] = (counts[session] ?: 0) + 1
            require(counts.getValue(session) <= 10000)
            val revision = note.path("revision")
            require(revision.isIntegralNumber && revision.canConvertToLong() && revision.longValue() >= 0)
            strings(note, "markdown", "createdAt", "updatedAt")
            require(note.path("markdown").asString().isNotBlank() && note.path("pinned").isBoolean)
            val created = java.time.Instant.parse(note.path("createdAt").asString())
            require(java.time.Instant.parse(note.path("updatedAt").asString()) >= created)
            for (name in listOf("scene", "resource")) {
                val context = note.path(name)
                if (!context.isNull) {
                    fields(context, "reference", "title"); string(context.path("title"))
                    require(context.path("title").asString().isNotBlank())
                    val reference = context.path("reference")
                    if (!reference.isNull) {
                        fields(reference, "campaign", "card"); uuid(reference.path("campaign")); uuid(reference.path("card"))
                    }
                }
            }
        }
        val records = tree.path("workspaces")
        require(records.isArray && records.size() <= 100)
        for (record in records) {
            fields(record, "session", "workspace"); uuid(record.path("session"))
            val workspace = record.path("workspace")
            if (!workspace.isNull) {
                fields(workspace, "session", "revision", "sessionCards", "used", "activeSceneItemId", "pile1", "pile2")
                uuid(workspace.path("session"))
                val revision = workspace.path("revision")
                require(revision.isIntegralNumber && revision.canConvertToLong() && revision.longValue() >= 0)
                if (!workspace.path("activeSceneItemId").isNull) uuid(workspace.path("activeSceneItemId"))
                for (name in listOf("sessionCards", "used")) ids(workspace.path(name))
                for (name in listOf("pile1", "pile2")) {
                    val pile = workspace.path(name)
                    fields(pile, "name", "items", "cover")
                    val title = pile.path("name")
                    require(title.isNull || (title.isString && title.asString().isNotBlank() && title.asString().length <= 200))
                    ids(pile.path("items"))
                    if (!pile.path("cover").isNull) uuid(pile.path("cover"))
                }
            }
        }
        val contents = tree.deepCopy() as tools.jackson.databind.node.ObjectNode
        contents.remove("workspaces"); contents.remove("notes")
        read(mapper.writeValueAsBytes(contents)).map {
            mapper.treeToValue(tree, workbench.sessionarchives.api.SessionTransfer::class.java)
        }
    } catch (_: Exception) { Either.Left(Failure.Invalid("sessions.archive-format", "Invalid or unsupported current-format session archive. No sessions imported.")) }

    override fun write(archive: Archive): ByteArray = boundedWrite(archive)
    private fun boundedWrite(archive: Any): ByteArray {
        val out = object : java.io.ByteArrayOutputStream() {
            override fun write(b: Int) { require(count < MAX_ARCHIVE); super.write(b) }
            override fun write(b: ByteArray, off: Int, len: Int) { require(count.toLong() + len <= MAX_ARCHIVE); super.write(b, off, len) }
        }
        mapper.writeValue(out, archive)
        return out.toByteArray()
    }
    override fun readIllustrated(bytes: ByteArray) = read(bytes)

    override fun read(bytes: ByteArray): Either<Failure, Archive> = try {
        require(bytes.size <= MAX_ARCHIVE)
        val tree = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes)
        fields(tree, "version", "sessions")
        integer(tree.path("version"))
        val version = tree.path("version").intValue()
        require(version in 10..11)
        val sessions = tree.path("sessions")
        require(sessions.isArray && sessions.size() in 1..100)
        var count = 0
        for (session in sessions) {
            val sessionFields = arrayOf("id", "campaign", "revision", "title", "objective", "notes", "items", "sceneLinks")
            fields(session, *sessionFields)
            uuid(session.path("id")); uuid(session.path("campaign"))
            val revision = session.path("revision")
            require(revision.isIntegralNumber && revision.canConvertToLong() && revision.longValue() >= 0)
            strings(session, "title", "objective", "notes")
            val edges = session.path("sceneLinks")
            require(edges.isArray && edges.size() <= 10000)
            for (edge in edges) {
                fields(edge, "scene", "item"); uuid(edge.path("scene")); uuid(edge.path("item"))
            }
            val items = session.path("items")
            require(items.isArray)
            count += items.size(); require(count <= 1000)
            for (item in items) {
                val names = arrayOf("id", "title", "markdown", "provenance", "anchors", "notes")
                fields(item, *(names + "capturedSource" + if (item.has("image")) arrayOf("image") else emptyArray()))
                if (item.has("image")) {
                    val image = item.path("image")
                    fields(image, "hash", "mime", "width", "height", "bytes")
                    strings(image, "hash", "mime"); listOf("width", "height", "bytes").forEach { integer(image.path(it)) }
                }
                uuid(item.path("id")); strings(item, "title", "markdown", "notes")
                val anchors = item.path("anchors")
                require(anchors.isObject)
                anchors.properties().forEach { string(it.value); require(it.key.toByteArray(Charsets.UTF_8).size <= MAX_TEXT) }
                val p = item.path("provenance")
                val provenanceFields = arrayOf("campaign", "capture", "path", "section", "documentHash", "contentHash")
                fields(p, *provenanceFields, "kind", "authored")
                uuid(p.path("campaign"))
                if (p.path("kind").asString() == "authored") {
                    require(p.path("capture").isNull)
                    authored(p.path("authored"))
                } else {
                    uuid(p.path("capture"))
                    require(p.path("kind").asString() == "source" && p.path("authored").isNull)
                }
                strings(p, "path", "documentHash", "contentHash")
                nullableString(p.path("section"))
                if (!item.path("capturedSource").isNull) captured(item.path("capturedSource"), version)
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
    private fun captured(node: JsonNode, version: Int) {
        fields(node, "interpretation", "bodyStart", "classification", "relationships")
        integer(node.path("interpretation")); integer(node.path("bodyStart"))
        classification(node.path("classification"), version)
        require(node.path("relationships").isArray)
        for (r in node.path("relationships")) {
            fields(r, "key", "originSection", "destination", "target", "classification", "sceneCandidate")
            strings(r, "key", "originSection", "destination")
            require(r.path("sceneCandidate").isBoolean)
            val target = r.path("target")
            fields(target, "document", "section", "external", "missing")
            listOf("document", "section", "external").forEach { nullableString(target.path(it)) }
            require(target.path("missing").isBoolean)
            if (!r.path("classification").isNull) classification(r.path("classification"), version)
        }
    }
    private fun classification(node: JsonNode, version: Int) {
        fields(node, "metadata", "issues")
        val metadata = node.path("metadata")
        if (!metadata.isNull) {
            fields(metadata, *(arrayOf("schema", "id", "title", "type", "purpose", "status", "tags", "summary") + if (version == 11) arrayOf("backText") else emptyArray()))
            if (version == 11) string(metadata.path("backText"))
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
    private fun ids(node: JsonNode) { require(node.isArray && node.size() <= 1000); node.forEach(::uuid) }
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
