package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import workbench.campaigns.api.*
import workbench.platform.api.*
import workbench.sources.adapter.markdown.CommonmarkMarkdown
import workbench.sources.api.*
import workbench.sources.application.*
import workbench.sources.domain.*
import java.security.MessageDigest
import java.util.UUID

private val cardId = "87b085da-326b-4cc4-933e-c908648ee712"
private fun card(body: String = "# Body\nReadable content", id: String = cardId, type: String = "scene", purpose: String = "session", status: String = "current", extra: String = "") =
    "---\nworkbench:\n  schema: 1\n  id: '$id'\n  title: Metadata title\n  type: $type\n  purpose: $purpose\n  status: $status\n$extra---\n$body"

private class TypedFixture {
    val campaign = UUID.randomUUID()
    val other = UUID.randomUUID()
    var content: Map<String, String> = emptyMap()
    val captures = mutableMapOf<UUID, Capture>()
    val service = SourceService(
        object : Campaigns { override fun configuration(id: UUID) = Either.Right(Campaign(id, "Example", "/example", listOf("**/*.md"), emptyList(), 0)) },
        object : CaptureStore {
            override fun get(campaign: UUID) = captures[campaign]
            override fun publish(capture: Capture) { captures[capture.campaign] = capture }
        },
        object : SourceScanner { override fun scan(scope: SourceScope) = Either.Right(content) },
        CommonmarkMarkdown(),
        object : Transactions { override fun <T> run(block: () -> Either<Failure, T>) = block() }
    )
    fun refresh(id: UUID = campaign) = service.refresh(id).getOrNull()!!.capture!!
}

class TypedSourcesTest : StringSpec({
    "metadata is separate from body, normalizes tags and does not interpret unrelated keys" {
        val parsed = CommonmarkMarkdown().parse(card(extra = "  tags: [Combat, ' combat ', reef]\n  summary: Authored summary\n  future: ignored\nother: untouched\n"))
        parsed.classification.metadata!!.tags shouldBe listOf("combat", "reef")
        parsed.classification.metadata!!.summary shouldBe "Authored summary"
        parsed.classification.issues.single().severity shouldBe "warning"
        parsed.sections.flatMap { it.blocks }.joinToString { it.text } shouldBe "Body, Readable content"
        parsed.sections.single().level shouldBe 1
        CommonmarkMarkdown().parse("---\nother: value\n---\n# Legacy").classification shouldBe SourceClassification()
        CommonmarkMarkdown().parse("# Legacy\nordinary YAML: text").bodyStart shouldBe 0
    }
    "invalid classifications stay readable without guessed labels" {
        val invalid = listOf(
            card(type = "monster"), card(id = "1-1-1-1-1"), card(purpose = "canon"), card(status = "approved"),
            card().replace("schema: 1", "schema: 2"), card().replace("schema: 1", "schema: '1'"),
            card().replace("  title: Metadata title\n", ""), card(extra = "  tags: null\n"),
            card(extra = "  summary: ${"s".repeat(1001)}\n"), card(extra = "  tags: [${List(33) { "tag$it" }.joinToString()}]\n"),
            card(extra = "  tags: [${"t".repeat(65)}]\n"), card().replace("title: Metadata title", "title: ${"t".repeat(201)}")
        )
        invalid.forEach { text ->
            val parsed = CommonmarkMarkdown().parse(text)
            parsed.classification.metadata shouldBe null
            parsed.classification.issues.isNotEmpty() shouldBe true
            parsed.sections.flatMap { it.blocks }.joinToString { it.text } shouldContain "Readable content"
        }
    }
    "bounded YAML rejects duplicate keys, aliases, tags, multiple documents and deep input without losing the body" {
        val envelopes = listOf(
            "workbench: {schema: 1, schema: 2}", "workbench: [broken", "workbench: !!java/object {}",
            "workbench: &a {title: text}\nother: *a", "value: &a scalar\nother: *a",
            "workbench: ${"[".repeat(18)}0${"]".repeat(18)}", "workbench: ${"x".repeat(65_537)}",
            "values: [${List(4100) { "x" }.joinToString()}]", "first: value\n...\nsecond: value"
        )
        envelopes.forEach { yaml ->
            val parsed = CommonmarkMarkdown().parse("---\n$yaml\n---\n# Still readable\nRetained prose")
            parsed.classification.metadata shouldBe null
            parsed.classification.issues.isNotEmpty() shouldBe true
            parsed.sections.single().heading shouldBe "Still readable"
        }
        val unclosed = CommonmarkMarkdown().parse("---\nworkbench: broken\n# Unclosed\nRetained prose")
        unclosed.bodyStart shouldBe 0
        unclosed.classification.issues.single().code shouldBe "metadata.unclosed"
        unclosed.sections.flatMap { it.blocks }.joinToString { it.text } shouldContain "Retained prose"
    }
    "BOM, CRLF and Unicode preserve raw hashes, subtree ranges and repeated anchor remapping" {
        val f = TypedFixture()
        val original = "\uFEFF" + card("Intro 🐙\n# Parent\nOne\n## Child\nNested 🐚\n## Child\nRepeated\n# Next\nTail").replace("\n", "\r\n")
        f.content = mapOf("odd folder/source.md" to original)
        val capture = f.refresh()
        val document = f.service.document(f.campaign, capture, "odd folder/source.md").getOrNull()!!
        val parent = document.sections.first { it.heading == "Parent" }
        parent.id shouldBe "s-${original.indexOf("# Parent") }"
        parent.level shouldBe 1
        document.sections.filter { it.heading == "Child" }.map { it.level } shouldBe listOf(2, 2)
        val selected = f.service.select(f.campaign, capture, "odd folder/source.md", parent.id).getOrNull()!!
        val expected = original.substring(original.indexOf("# Parent"), original.indexOf("# Next"))
        selected.markdown shouldBe expected
        fun hash(text: String) = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        selected.documentHash shouldBe hash(original)
        selected.contentHash shouldBe hash(expected)
        selected.anchors shouldBe mapOf("parent" to "parent", "child" to "child", "child-1" to "child-1")
        val secondChild = document.sections.last { it.heading == "Child" }.id
        f.service.select(f.campaign, capture, "odd folder/source.md", secondChild).getOrNull()!!.anchors shouldBe mapOf("child-1" to "child")
        val whole = f.service.select(f.campaign, capture, "odd folder/source.md", null).getOrNull()!!
        whole.markdown shouldBe original
        whole.contentHash shouldBe hash(original)
        original.substring(whole.bodyStart).startsWith("Intro") shouldBe true
        f.service.select(f.campaign, capture, "odd folder/source.md", "start").getOrNull()!!.markdown shouldBe "Intro 🐙\r\n"
    }
    "combined filters and full body search retain capture identity and expose issues and legacy material" {
        val f = TypedFixture()
        f.content = mapOf(
            "flat.md" to card(extra = "  tags: [Combat, reef]\n  summary: Summarysecret\n"),
            "different/deep.md" to card("# Person\nHidden background needle", UUID.randomUUID().toString(), "npc", status = "draft", extra = "  tags: [reef]\n"),
            "guide.md" to card(id = UUID.randomUUID().toString(), purpose = "guidance"),
            "legacy.md" to "# Ordinary\nLegacy needle", "invalid.md" to card(id = UUID.randomUUID().toString(), type = "unknown")
        )
        val capture = f.refresh()
        val filter = SourceFilter(types = setOf("scene", "npc"), tags = setOf(" REEF "), purposes = setOf("session"), statuses = setOf("draft"))
        f.service.library(f.campaign, filter).getOrNull()!!.documents.map { it.path } shouldBe listOf("different/deep.md")
        f.service.library(f.campaign, SourceFilter(tags = setOf("combat", "reef"))).getOrNull()!!.documents.map { it.path } shouldBe listOf("flat.md")
        val result = f.service.search(f.campaign, capture, "needle", filter).getOrNull()!!
        result.campaign shouldBe f.campaign
        result.capture shouldBe capture
        result.hits.single().path shouldBe "different/deep.md"
        f.service.search(f.campaign, capture, "METADATA TITLE", filter).getOrNull()!!.hits.size shouldBe 1
        f.service.search(f.campaign, capture, "combat").getOrNull()!!.hits.single().path shouldBe "flat.md"
        f.service.search(f.campaign, capture, "Summarysecret").getOrNull()!!.hits shouldBe emptyList()
        f.service.search(f.campaign, capture, "schema").getOrNull()!!.hits shouldBe emptyList()
        f.service.library(f.campaign, SourceFilter(unclassified = true)).getOrNull()!!.documents.map { it.path } shouldBe listOf("invalid.md", "legacy.md")
        f.service.library(f.campaign, SourceFilter(issues = true)).getOrNull()!!.documents.map { it.path } shouldBe listOf("invalid.md")
    }
    "duplicate IDs never merge documents, are campaign scoped and disappear after explicit refresh" {
        val f = TypedFixture()
        f.content = mapOf("one.md" to card())
        val otherCapture = f.refresh(f.other)
        f.content = mapOf("one.md" to card(), "two.md" to card())
        val capture = f.refresh()
        val documents = f.service.library(f.campaign).getOrNull()!!.documents
        documents.size shouldBe 2
        documents.all { it.classification.metadata == null && it.classification.issues.single().code == "metadata.duplicate-id" } shouldBe true
        f.service.document(f.other, otherCapture, "one.md").getOrNull()!!.classification.metadata!!.id.toString() shouldBe cardId
        f.content = mapOf("renamed.md" to card())
        f.service.library(f.campaign).getOrNull()!!.documents.size shouldBe 2
        val refreshed = f.refresh()
        f.service.document(f.campaign, refreshed, "renamed.md").getOrNull()!!.classification.metadata!!.id.toString() shouldBe cardId
        f.service.select(f.campaign, capture, "one.md", null).leftOrNull()!!.code shouldBe "sources.capture-replaced"
    }
    "direct selections reject explicit non-session purposes including otherwise invalid classification" {
        val f = TypedFixture()
        f.content = mapOf("guide.md" to card(purpose = "guidance"), "tool.md" to card(purpose = "tooling", type = "invalid"),
            "legacy.md" to "# Legacy", "invalid.md" to card(type = "invalid"))
        val capture = f.refresh()
        listOf("guide.md", "tool.md").forEach { path ->
            val section = f.service.document(f.campaign, capture, path).getOrNull()!!.sections.first().id
            listOf(null, section).forEach { f.service.select(f.campaign, capture, path, it).leftOrNull()!!.code shouldBe "sources.not-session-material" }
        }
        listOf("legacy.md", "invalid.md").forEach { f.service.select(f.campaign, capture, it, null).isRight() shouldBe true }
    }
    "relationships stay capture local and section selection includes only selected links" {
        val f = TypedFixture()
        f.content = mapOf(
            "adventure.md" to card("# Overview\n[scene](nested/a%20scene.md#repeat-1)\n## Detail\n[guide](guide.md) [absent](missing.md) [external](https://example.org)\n# Outside\n[outside](nested/a%20scene.md)", type = "adventure"),
            "nested/a scene.md" to card("# Repeat\nFirst\n# Repeat\nSecond", UUID.randomUUID().toString()),
            "guide.md" to card(id = UUID.randomUUID().toString(), purpose = "guidance")
        )
        val capture = f.refresh()
        val doc = f.service.document(f.campaign, capture, "adventure.md").getOrNull()!!
        val scene = doc.relationships.first()
        scene.sceneCandidate shouldBe true
        scene.target.section shouldBe f.service.document(f.campaign, capture, "nested/a scene.md").getOrNull()!!.sections.last().id
        scene.originSection shouldBe doc.sections.first().id
        doc.relationships[1].sceneCandidate shouldBe false
        doc.relationships[2].target.missing shouldBe true
        doc.relationships[2].destination shouldBe "missing.md"
        doc.relationships[3].target.external shouldBe "https://example.org"
        val selection = f.service.select(f.campaign, capture, "adventure.md", doc.sections[1].id).getOrNull()!!
        selection.relationships.map { it.destination } shouldBe listOf("guide.md", "missing.md", "https://example.org")
        selection.markdown.contains("# Overview") shouldBe false
        f.content = emptyMap()
        f.service.document(f.campaign, capture, "adventure.md").getOrNull() shouldBe doc
    }
})
