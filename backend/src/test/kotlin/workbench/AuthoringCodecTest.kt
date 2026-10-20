package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import workbench.sources.adapter.markdown.CommonmarkMarkdown
import workbench.sources.adapter.markdown.MarkdownAuthoring
import workbench.sources.api.AuthoredDocument
import workbench.sources.api.AuthoredTarget
import java.util.UUID

class AuthoringCodecTest : StringSpec({
    val codec = MarkdownAuthoring(CommonmarkMarkdown())
    "retained scalar types and unknown fields survive canonical encoding without changing body text" {
        val raw = "---\ncustom: {text: '007', numeric: 7, bool: true, nil: null, values: [x, 2]}\nworkbench: {schema: 1, extension: {text: 'false'}}\n---\n---\nA thematic break\n\r\n🌊"
        val decoded = codec.decode(raw)
        decoded.errors shouldBe emptyList()
        val card = UUID.randomUUID()
        val input = AuthoredDocument(card, "A: 'quoted'\n# literal", "npc", "draft", listOf("Harbour"), null, decoded.body)
        val encoded = codec.encode(input, decoded.retainedEnvelope)
        encoded.errors shouldBe emptyList()
        encoded.preview.classification.metadata!!.id shouldBe card
        encoded.preview.classification.metadata!!.title shouldBe input.title
        codec.decode(encoded.markdown).body shouldBe decoded.body
        codec.decode(encoded.markdown).retainedEnvelope shouldBe decoded.retainedEnvelope
    }
    "unsafe metadata stays readable but cannot be copied or exported with silent loss" {
        for (envelope in listOf("workbench: {schema: 2}", "workbench: []", "workbench: {tags: [1]}", "workbench: {title: 1}", "workbench: {purpose: tooling}", "a: 1\na: 2", "a: &ref [1]\nb: *ref", "1: value", "a: !!str value", "[one, two]")) {
            codec.decode("---\n$envelope\n---\nReadable body").errors.isNotEmpty() shouldBe true
        }
        codec.decode("---\nworkbench: {}\nUnclosed").errors.isNotEmpty() shouldBe true
        codec.decode("---\nextra: '${"x".repeat(65_536)}'\n---\nBody").errors.isNotEmpty() shouldBe true
        val input = AuthoredDocument(UUID.randomUUID(), "Draft", "npc", "draft", emptyList(), null, "---\r\nworkbench: {}\r\n---\r\nNested")
        codec.encode(input).errors.isNotEmpty() shouldBe true
    }
    "links distinguish original sources, self, draft dependencies, ambiguity and unsupported destinations" {
        val id = UUID.randomUUID()
        val draft = AuthoredTarget(id, 2, "notes/copy.md", "# Same\n# Same")
        val body = "[original](original.md#same-1) [self](copy.md#same-1) [draft](../other.md#one) [escape](../../out.md) [encoded](../place%20name.md#dock) [query](original.md?q=x) [unsafe](file:///tmp/x) [local](#absent)"
        val other = AuthoredTarget(UUID.randomUUID(), 3, "other.md", "# One")
        val sources = mapOf("notes/original.md" to "# Same\n# Same", "place name.md" to "# Dock")
        val links = codec.links(draft.path, body, sources, listOf(draft, other), id)
        links.map { it.kind } shouldBe listOf("source", "self", "draft", "unsupported", "source", "unsupported", "unsupported", "missing-anchor")
        links[2].revision shouldBe 3
        codec.links(draft.path, "[ambiguous](../other.md)", sources + ("other.md" to "# One"), listOf(draft, other), id).single().kind shouldBe "ambiguous"
    }
    "opening thematic rules and literal YAML remain exportable with BOM and either line ending" {
        val bodies = listOf(
            "---\nAn ordinary opening thematic rule.\n\n```yaml\nworkbench: example\n```\n",
            "---\n```yaml\nworkbench: example\n```\n",
            "---\nOrdinary prose.\n---\nworkbench: later Markdown\n",
            "---\nexample: workbench\n---\nBody\n",
            "---\nexample:\n  workbench: nested example\n---\nBody\n"
        )
        for (body in bodies) for (ending in listOf("\n", "\r\n")) for (bom in listOf("", "\uFEFF")) {
            val exact = bom + body.replace("\n", ending)
            val result = codec.encode(AuthoredDocument(UUID.randomUUID(), "Draft", "npc", "draft", emptyList(), null, exact))
            result.errors shouldBe emptyList()
            codec.decode(result.markdown).body shouldBe exact
        }
    }
    "closed and incomplete opening owned mappings are blocked consistently without rewriting the body" {
        val bodies = listOf(
            "---\nworkbench: {}\n---\nNested\n",
            "---\nworkbench: {}\nUnclosed\n",
            "---\n# Comment\n\nworkbench: {}\nUnclosed\n",
            "---\ncustom: [one, two]\nworkbench: {}\nUnclosed\n",
            "---\ncustom: value\n'workbench': {}\n---\nNested\n",
            "---\n{custom: value, workbench: {}}\n---\nNested\n"
        )
        for (body in bodies) for (ending in listOf("\n", "\r\n")) for (bom in listOf("", "\uFEFF")) {
            val exact = bom + body.replace("\n", ending)
            val result = codec.encode(AuthoredDocument(UUID.randomUUID(), "Draft", "npc", "draft", emptyList(), null, exact))
            result.preview.classification.issues.any { it.code == "writing.body-envelope" } shouldBe true
            codec.decode(result.markdown).body shouldBe exact
        }
    }
})
