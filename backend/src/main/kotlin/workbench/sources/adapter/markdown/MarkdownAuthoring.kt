package workbench.sources.adapter.markdown

import org.springframework.stereotype.Component
import org.snakeyaml.engine.v2.api.Dump
import org.snakeyaml.engine.v2.api.DumpSettings
import workbench.sources.api.*
import workbench.sources.application.linkDestination

@Component
class MarkdownAuthoring(private val markdown: CommonmarkMarkdown) : Authoring {
    private val headings = linkedMapOf(
        "npc" to listOf("Quick reference", "Motivation", "Appearance", "Relationships", "Background"),
        "location" to listOf("Quick reference", "Read aloud", "Features", "Connections", "Background"),
        "faction" to listOf("Quick reference", "Goals", "Members", "Relationships", "Background"),
        "item" to listOf("Quick reference", "Description", "Mechanics", "Background"),
        "scene" to listOf("Quick reference", "Read aloud", "Situation", "Clues", "Mechanics", "Outcomes", "Design notes"),
        "adventure" to listOf("Overview", "Scenes", "Leads", "Timeline", "Design notes"),
        "handout" to listOf("Handout text", "DM notes"), "reference" to listOf("Quick reference", "Details")
    )
    override fun catalog() = AuthoringCatalog(headings.keys.toList(), listOf("draft", "current", "superseded"), headings.mapValues { (_, sections) -> sections.joinToString("\n\n", postfix = "\n") { "## $it\n" } })
    private val owned = setOf("schema", "id", "title", "type", "purpose", "status", "tags", "summary")
    private fun dump(data: Any) = Dump(DumpSettings.builder().build()).dumpToString(data)
    private fun safe(value: Any?): Boolean = when (value) {
        null, is String, is Boolean, is Number -> true
        is Map<*, *> -> value.keys.all { it is String } && value.values.all(::safe)
        is List<*> -> value.all(::safe)
        else -> false
    }
    override fun decode(raw: String): DecodedAuthoring {
        val front = WorkbenchFrontMatter().extract(raw)
        val errors = mutableListOf<String>()
        val root = front.data ?: emptyMap<String, Any?>()
        val fields = root["workbench"] as? Map<*, *> ?: emptyMap<String, Any?>()
        if (front.classification.issues.any { it.code in setOf("metadata.yaml", "metadata.limit", "metadata.unclosed", "metadata.mapping") }) errors += "Source front matter cannot be preserved safely. Resolve its structural issues before copying."
        if (!safe(root)) errors += "Retained metadata requires string mapping keys and safe scalar/list/mapping values."
        if (fields.containsKey("schema") && fields["schema"] != 1) errors += "Unsupported Workbench schema; copying would change its interpretation."
        if (fields["purpose"] in setOf("guidance", "tooling")) errors += "Guidance/tooling cannot be copied into session-purpose drafts."
        for (key in listOf("title", "type", "summary")) if (fields[key] != null && fields[key] !is String) errors += "Source $key has an incompatible value; resolve it before copying."
        val tags = fields["tags"]
        if (tags != null && (tags !is List<*> || tags.any { it !is String })) errors += "Source tags must be a list of text values before copying."
        val extras = root.entries.filter { it.key != "workbench" }.associate { it.key to it.value }.toMutableMap()
        val extraFields = fields.entries.filter { it.key !in owned }.associate { it.key to it.value }
        if (extraFields.isNotEmpty()) extras["workbench"] = extraFields
        return DecodedAuthoring(!root.containsKey("workbench"), raw.substring(front.bodyStart), if (extras.isEmpty() || errors.isNotEmpty()) "" else dump(extras),
            fields["title"] as? String ?: "", fields["type"] as? String ?: "", (tags as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
            fields["summary"] as? String ?: "", front.classification.issues.map { it.message }, errors, front.declaredId)
    }
    override fun encode(input: AuthoredDocument, retainedEnvelope: String): EncodedAuthoring {
        val errors = mutableListOf<String>()
        val retained = if (retainedEnvelope.isBlank()) emptyMap<String, Any?>() else {
            val decoded = WorkbenchFrontMatter().extract("---\n$retainedEnvelope---\n")
            val value = decoded.data
            if (value == null || !safe(value) || decoded.classification.issues.any { it.code in setOf("metadata.yaml", "metadata.limit", "metadata.unclosed", "metadata.mapping") }) {
                errors += "Retained metadata cannot be preserved safely."; emptyMap<String, Any?>()
            } else value
        }
        val fields = linkedMapOf<String, Any>("schema" to 1, "id" to input.card.toString(), "title" to input.title, "type" to input.type, "purpose" to "session", "status" to input.status, "tags" to input.tags)
        if (!input.summary.isNullOrBlank()) fields["summary"] = input.summary
        val root = retained.entries.filter { it.key != "workbench" }.associate { it.key to it.value }.toMutableMap()
        val unknown = (retained["workbench"] as? Map<*, *>)?.entries?.filter { it.key !in owned }?.associate { it.key to it.value } ?: emptyMap()
        root["workbench"] = unknown + fields
        val encoded = "---\n${dump(root)}---\n${input.body}"
        val parsed = markdown.parse(encoded)
        val conflictingBody = WorkbenchFrontMatter().hasOwnedEnvelope(input.body)
        val issues = if (conflictingBody)
            parsed.classification.issues + ClassificationIssue("writing.body-envelope", "body", "The body must not contain a second front-matter envelope.") else parsed.classification.issues
        val classification = if (issues.any { it.severity == "error" }) parsed.classification.copy(metadata = null, issues = issues) else parsed.classification
        val links = parsed.links.map { link ->
            val d = linkDestination("draft.md", link.destination)
            val anchor = d.anchor?.takeIf { d.local && it in parsed.anchors }
            AuthoringLink(link.key, anchor, d.external, anchor == null && d.external == null)
        }
        errors += issues.filter { it.severity == "error" }.map { it.message }
        return EncodedAuthoring(encoded, AuthoredPreview(classification, parsed.sections, parsed.anchors, links), errors)
    }
    override fun inspect(input: AuthoredDocument) = encode(input).preview

    override fun links(path: String, body: String, sources: Map<String, String>, drafts: List<AuthoredTarget>, own: java.util.UUID): List<CheckedLink> {
        val parsedBody = markdown.parse("---\nworkbench: {}\n---\n$body")
        val sourceParsed = sources.mapValues { markdown.parse(it.value) }
        val draftParsed = drafts.associate { it.id to markdown.parse("---\nworkbench: {}\n---\n${it.body}") }
        return parsedBody.links.map { link ->
            val d = linkDestination(path, link.destination)
            fun result(kind: String, warning: String? = null, section: String? = null, target: AuthoredTarget? = null) = CheckedLink(link.key, link.destination, kind, d.path, d.anchor, section, d.external, target?.id, target?.revision, warning)
            when {
                !d.valid -> result("unsupported", "Unsupported or unsafe link: ${link.destination}")
                d.external != null -> result("external")
                d.local -> if (d.anchor == null || d.anchor in parsedBody.anchors) result("local", section = d.anchor?.let { parsedBody.anchors[it] }) else result("missing-anchor", "Missing local heading: ${d.anchor}")
                else -> {
                    val candidates = drafts.filter { it.path == d.path }
                    val source = sourceParsed[d.path]
                    if (candidates.size + (if (source != null) 1 else 0) > 1) result("ambiguous", "Several source/draft documents share ${d.path}.")
                    else if (source != null) {
                        if (d.anchor != null && d.anchor !in source.anchors) result("missing-anchor", "Missing heading ${d.anchor} in ${d.path}.")
                        else result("source", section = d.anchor?.let { source.anchors[it] })
                    } else if (candidates.size == 1) {
                        val target = candidates.single(); val parsed = draftParsed.getValue(target.id)
                        if (d.anchor != null && d.anchor !in parsed.anchors) result("missing-anchor", "Missing draft heading ${d.anchor} in ${d.path}.", target = target)
                        else if (target.id == own) result("self", section = d.anchor?.let { parsed.anchors[it] }, target = target)
                        else result("draft", "${d.path} is a draft and must also be exported/incorporated.", target = target, section = d.anchor?.let { parsed.anchors[it] })
                    } else result("missing-document", "Missing document: ${d.path}.")
                }
            }
        }
    }
}
