package workbench.sources.adapter.markdown

import org.snakeyaml.engine.v2.api.Load
import org.snakeyaml.engine.v2.api.LoadSettings
import org.snakeyaml.engine.v2.api.lowlevel.Parse
import org.snakeyaml.engine.v2.events.*
import org.snakeyaml.engine.v2.schema.JsonSchema
import workbench.sources.api.*
import java.util.Locale
import java.util.UUID

internal data class FrontMatter(val bodyStart: Int = 0, val classification: SourceClassification = SourceClassification(), val declaredPurpose: String? = null, val declaredId: UUID? = null, val data: Map<*, *>? = null)

/** Decode data only. Raw source and all offsets remain owned by the Markdown capture. */
internal class WorkbenchFrontMatter {
    private val settings = LoadSettings.builder().setSchema(JsonSchema()).setAllowDuplicateKeys(false)
        .setAllowRecursiveKeys(false).setAllowNonScalarKeys(false).setMaxAliasesForCollections(0)
        .setCodePointLimit(65_536).build()

    /** Inspect only an opening YAML mapping, including an incomplete one; never scan later Markdown. */
    fun hasOwnedEnvelope(text: String): Boolean {
        val prefix = text.removePrefix("\uFEFF").take(65_536)
        val lines = prefix.lineSequence().iterator()
        if (!lines.hasNext() || lines.next() != "---") return false
        val yaml = buildString {
            while (lines.hasNext()) {
                val line = lines.next()
                if (line == "---") break
                append(line).append('\n')
            }
        }
        return try {
            var depth = 0
            var rootMapping = false
            var rootItems = 0
            var events = 0
            for (event in Parse(settings).parseString(yaml)) {
                if (++events > 4096) return false
                when (event) {
                    is CollectionStartEvent -> {
                        if (depth == 0) rootMapping = event is MappingStartEvent
                        if (depth == 1) rootItems++
                        if (++depth > 16) return false
                    }
                    is CollectionEndEvent -> if (--depth == 0) return false
                    is ScalarEvent -> if (rootMapping && depth == 1) {
                        if (rootItems % 2 == 0 && event.value == "workbench") return true
                        rootItems++
                    }
                    is AliasEvent -> if (depth == 1) rootItems++
                    else -> Unit
                }
            }
            false
        } catch (_: Exception) { false }
    }

    fun extract(text: String): FrontMatter {
        val start = if (text.startsWith('\uFEFF')) 1 else 0
        fun lineEnd(at: Int) = text.indexOf('\n', at).let { if (it < 0) text.length else it }
        val firstEnd = lineEnd(start)
        if (text.substring(start, firstEnd).removeSuffix("\r") != "---") return FrontMatter()
        var cursor = minOf(firstEnd + 1, text.length)
        var close = -1
        var bodyStart = 0
        while (cursor < text.length) {
            val end = lineEnd(cursor)
            if (text.substring(cursor, end).removeSuffix("\r") == "---") {
                close = cursor; bodyStart = minOf(end + 1, text.length); break
            }
            cursor = minOf(end + 1, text.length)
        }
        fun failure(code: String, message: String, offset: Int = bodyStart) = FrontMatter(offset,
            SourceClassification(issues = listOf(ClassificationIssue(code, null, message))))
        if (close < 0) return failure("metadata.unclosed", "Front matter has no closing delimiter; source remains visible.", 0)
        if (close - start > 65_536 || text.substring(start, close).toByteArray(Charsets.UTF_8).size > 65_536)
            return failure("metadata.limit", "Front matter exceeds 64 KiB.")
        val yaml = text.substring(minOf(firstEnd + 1, text.length), close)
        val root = try {
            // Check the event stream before constructing collections, including scalar aliases.
            var depth = 0
            var events = 0
            var documents = 0
            for (event in Parse(settings).parseString(yaml)) {
                require(++events <= 4096) { "Too many YAML events" }
                if (event is DocumentStartEvent) require(++documents <= 1) { "Multiple YAML documents" }
                require(event !is AliasEvent) { "Aliases are unsupported" }
                if (event is CollectionStartEvent) { require(++depth <= 16) { "YAML nesting exceeds 16" }; require(event.tag.isEmpty) { "Explicit tags are unsupported" } }
                if (event is CollectionEndEvent) depth--
                if (event is ScalarEvent) require(event.tag.isEmpty) { "Explicit tags are unsupported" }
            }
            Load(settings).loadFromString(yaml)
        } catch (_: Exception) { return failure("metadata.yaml", "Invalid or unsupported YAML; use one data mapping without duplicate keys, aliases or explicit tags (maximum depth 16 and 4096 events).") }
        if (root !is Map<*, *>) return failure("metadata.mapping", "Front matter must be a mapping.")
        if (!root.containsKey("workbench")) return FrontMatter(bodyStart, data = root)
        val fields = root["workbench"] as? Map<*, *> ?: return failure("metadata.mapping", "workbench must be a mapping.").copy(data = root)
        val issues = mutableListOf<ClassificationIssue>()
        fun issue(field: String, message: String) { issues += ClassificationIssue("metadata.field", field, message) }
        fun string(field: String, limit: Int, required: Boolean = true): String? {
            if (!required && !fields.containsKey(field)) return null
            val value = fields[field] as? String
            if (value == null || value.isBlank() || value.length > limit) { issue(field, "Expected a nonblank string of at most $limit characters."); return null }
            return value.trim()
        }
        fun label(field: String, accepted: Set<String>): String? {
            val value = string(field, 32)
            if (value != null && value !in accepted) { issue(field, "Unsupported $field value."); return null }
            return value
        }
        val schema = fields["schema"]
        if (schema !is Int || schema != 1) issue("schema", "Expected integer schema 1.")
        val rawId = string("id", 36)
        val id = rawId?.let { value -> runCatching { UUID.fromString(value).takeIf { it.toString() == value } }.getOrNull() }
        if (rawId != null && id == null) issue("id", "Expected a canonical lowercase UUID.")
        val title = string("title", 200)
        val type = label("type", setOf("npc", "location", "faction", "item", "scene", "adventure", "handout", "reference"))
        val purpose = label("purpose", setOf("session", "guidance", "tooling"))
        val status = label("status", setOf("draft", "current", "superseded"))
        val summary = string("summary", 1000, false)
        val rawTags = fields["tags"]
        val tags = if (!fields.containsKey("tags")) emptyList() else if (rawTags !is List<*> || rawTags.size > 32 || rawTags.any { it !is String || it.isBlank() || it.length > 64 }) {
            issue("tags", "Expected at most 32 nonblank strings of at most 64 characters."); emptyList()
        } else rawTags.map { (it as String).trim().lowercase(Locale.ROOT) }.distinct()
        val known = setOf("schema", "id", "title", "type", "purpose", "status", "tags", "summary")
        fields.keys.filter { it !in known }.forEach { issues += ClassificationIssue("metadata.unknown-field", it?.toString(), "Unknown Workbench field is ignored.", "warning") }
        val metadata = if (issues.none { it.severity == "error" }) CardMetadata(1, id!!, title!!, type!!, purpose!!, status!!, tags, summary) else null
        return FrontMatter(bodyStart, SourceClassification(metadata, issues), purpose, id, root)
    }
}
