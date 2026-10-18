package workbench.preparation.application

import workbench.preparation.api.*
import java.util.Locale

/** Validate the frozen contract, without reclassifying Markdown or consulting current sources. */
internal fun validCapture(item: PreparedItemData): Boolean {
    val source = item.capturedSource ?: return true
    fun text(value: String, limit: Int = 2 * 1024 * 1024) = value.toByteArray(Charsets.UTF_8).size <= limit
    fun classification(value: CapturedClassificationData): Boolean {
        val card = value.metadata
        return value.issues.size <= 4096 && value.issues.all {
            it.code.isNotBlank() && text(it.code, 256) && (it.field == null || text(it.field, 65_536)) && text(it.message, 65_536) && it.severity in setOf("warning", "error")
        } && (card == null || (card.schema == 1 && card.title.isNotBlank() && card.title.length <= 200 &&
            card.type in setOf("npc", "location", "faction", "item", "scene", "adventure", "handout", "reference") &&
            card.purpose in setOf("session", "guidance", "tooling") && card.status in setOf("draft", "current", "superseded") &&
            // The authored limit is 64 UTF-16 units; Unicode lowercasing can expand that value.
            card.tags.size <= 32 && card.tags.distinct().size == card.tags.size && card.tags.all { it.isNotBlank() && it.length <= 128 && it == it.trim().lowercase(Locale.ROOT) } &&
            (card.summary == null || (card.summary.isNotBlank() && card.summary.length <= 1000)) && value.issues.none { it.severity == "error" }))
    }
    if (source.interpretation != 1 || !classification(source.classification) ||
        source.classification.metadata?.purpose?.let { it != "session" } == true ||
        source.bodyStart !in 0..item.markdown.length || (item.provenance.section != null && source.bodyStart != 0)) return false
    // An offset may only suppress the first closed metadata envelope, never arbitrary prose.
    if (source.bodyStart > 0) {
        val text = item.markdown
        val start = if (text.startsWith('\uFEFF')) 1 else 0
        fun end(at: Int) = text.indexOf('\n', at).let { if (it < 0) text.length else it }
        val first = end(start)
        if (text.substring(start, first).removeSuffix("\r") != "---") return false
        var cursor = minOf(first + 1, text.length)
        var expected = -1
        while (cursor < text.length) {
            val last = end(cursor)
            if (text.substring(cursor, last).removeSuffix("\r") == "---") { expected = minOf(last + 1, text.length); break }
            cursor = minOf(last + 1, text.length)
        }
        if (expected != source.bodyStart) return false
    }
    return source.relationships.map { it.key }.distinct().size == source.relationships.size && source.relationships.all { relation ->
        val target = relation.target
        relation.key.matches(Regex("source-link-[0-9]+")) && relation.originSection.matches(Regex("start|s-[0-9]+")) &&
            text(relation.destination) && (target.document == null || text(target.document, 4096)) &&
            (target.section == null || text(target.section, 256)) && (target.external == null || text(target.external)) &&
            (relation.classification == null || classification(relation.classification)) &&
            !(target.document != null && target.external != null) &&
            (!relation.sceneCandidate || (!target.missing && target.document != null && relation.classification?.metadata?.let { it.type == "scene" && it.purpose == "session" } == true))
    }
}
