package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import workbench.preparation.adapter.markdown.CommonmarkPreparation
import workbench.preparation.api.PreparedTarget
import workbench.preparation.domain.*
import java.util.UUID

class FrozenTargetsTest : StringSpec({
    val markdown = CommonmarkPreparation()
    val campaign = UUID.randomUUID()
    val capture = UUID.randomUUID()
    fun source(path: String, section: String? = null, anchors: Map<String, String> = emptyMap()) = PreparedItem(
        UUID.randomUUID(), path, "# Heading", Provenance(campaign, capture, path, section, "hash", "hash"), anchors, "")

    "source candidates preserve preparation order, exact capture and anchor constraints" {
        val origin = source("scenes/start.md")
        val full = source("npc.md", anchors = mapOf("history" to "s-8"))
        val section = source("npc.md", "s-8", mapOf("history" to "s-8"))
        val wrongSection = source("npc.md", "s-90", mapOf("other" to "s-90"))
        val refreshed = full.copy(id = UUID.randomUUID(), provenance = full.provenance.copy(capture = UUID.randomUUID()))
        val foreign = full.copy(id = UUID.randomUUID(), provenance = full.provenance.copy(campaign = UUID.randomUUID()))
        val items = listOf(section, refreshed, foreign, full, wrongSection, origin)
        markdown.targets(origin, items, 0, "../npc.md#history") shouldBe listOf(PreparedTarget(section.id, "s-8"), PreparedTarget(full.id, "s-8"))
        markdown.targets(origin, items, 0, "../npc.md") shouldBe listOf(PreparedTarget(full.id, null))
        markdown.targets(origin, items, 0, "../npc.md#missing") shouldBe emptyList()
        for (unsafe in listOf("../../npc.md", "/npc.md", "https://example.org/npc.md", "javascript:alert(1)", "../npc.md?x=1", "..\\npc.md"))
            markdown.targets(origin, items, 0, unsafe) shouldBe emptyList()
    }
    "authored targets require exact revision and share reader resolution" {
        val targetDraft = UUID.randomUUID()
        fun authored(draft: UUID, revision: Long, links: List<FrozenLink> = emptyList()) = source("draft.md").let { item ->
            item.copy(provenance = item.provenance.copy(kind = "authored", capture = null,
                authored = AuthoredOrigin(draft, UUID.randomUUID(), revision, UUID.randomUUID(), "2026-10-23T00:00:00Z", null, null, null, null, null, links)))
        }
        val destination = "target.md"
        val origin = authored(UUID.randomUUID(), 1, listOf(FrozenLink(destination, "draft", null, null, null, null, targetDraft, 2))).copy(markdown = "[Target]($destination)")
        val old = authored(targetDraft, 1)
        val exact = authored(targetDraft, 2)
        val duplicate = exact.copy(id = UUID.randomUUID())
        val newer = authored(targetDraft, 3)
        val items = listOf(origin, newer, exact, old, duplicate)
        markdown.targets(origin, items, 0, destination) shouldBe listOf(PreparedTarget(exact.id, null), PreparedTarget(duplicate.id, null))
        markdown.captured(items).getValue(origin.id).links.single().target shouldBe "@${exact.id}#"
        markdown.targets(origin, items, 0, "changed.md") shouldBe emptyList()
    }
})
