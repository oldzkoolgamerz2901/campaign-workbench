package workbench.sources.adapter.markdown

import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.node.*
import org.commonmark.parser.IncludeSourceSpans
import org.commonmark.parser.Parser
import org.commonmark.renderer.NodeRenderer
import org.commonmark.renderer.html.HtmlRenderer
import org.commonmark.renderer.html.HtmlNodeRendererContext
import org.springframework.stereotype.Component
import workbench.sources.api.*
import workbench.sources.application.*
import java.util.Locale

@Component
class CommonmarkMarkdown : Markdown {
    private val extensions = listOf(TablesExtension.create())
    private val parser = Parser.builder().extensions(extensions).includeSourceSpans(IncludeSourceSpans.BLOCKS_AND_INLINES).build()
    override fun parse(text: String): ParsedDocument {
        val root = parser.parse(text)
        val links = mutableListOf<ParsedLink>()
        val renderer = HtmlRenderer.builder().extensions(extensions).escapeHtml(true).sanitizeUrls(true)
            .nodeRendererFactory { context -> SafeLinks(context, links) }.build()
        val sections = mutableListOf<SourceSection>()
        val anchors = linkedMapOf<String, String>()
        val used = mutableSetOf<String>()
        var heading = "Document"
        var sectionId = "start"
        var blocks = mutableListOf<SourceBlock>()
        fun finish() { if (blocks.isNotEmpty()) sections += SourceSection(sectionId, heading, blocks.toList()) }
        var blockIndex = 0
        var node = root.firstChild
        while (node != null) {
            val current = node
            if (current is Heading) {
                finish(); blocks = mutableListOf()
                heading = plain(current)
                sectionId = "s-${current.sourceSpans.firstOrNull()?.inputIndex ?: sections.size}"
                val base = heading.lowercase(Locale.ROOT).replace(Regex("""[^\p{L}\p{N}_ -]"""), "").replace(' ', '-').ifBlank { "section" }
                var slug = base; var suffix = 1
                while (!used.add(slug)) { slug = "$base-${suffix++}" }
                anchors[slug] = sectionId
            }
            blocks += SourceBlock("b-${blockIndex++}", renderer.render(current), plain(current))
            node = current.next
        }
        finish()
        if (sections.isEmpty()) sections += SourceSection("start", "Document", listOf(SourceBlock("b-0", "", "")))
        val headings = mutableListOf<Triple<String, Int, Int>>()
        var cursor = root.firstChild
        while (cursor != null) {
            if (cursor is Heading) {
                val offset = cursor.sourceSpans.first().inputIndex
                headings += Triple("s-$offset", offset, cursor.level)
            }
            cursor = cursor.next
        }
        val ranges = headings.mapIndexed { index, h ->
            h.first to SectionRange(h.second, headings.drop(index + 1).firstOrNull { it.third <= h.third }?.second ?: text.length)
        }.toMap().toMutableMap()
        if (sections.any { it.id == "start" }) ranges["start"] = SectionRange(0, headings.firstOrNull()?.second ?: text.length)
        return ParsedDocument(sections, anchors, links, ranges)
    }
    private fun plain(node: Node): String {
        val out = StringBuilder()
        node.accept(object : AbstractVisitor() {
            override fun visit(text: Text) { out.append(text.literal) }
            override fun visit(code: Code) { out.append(code.literal) }
            override fun visit(code: FencedCodeBlock) { out.append(code.literal) }
            override fun visit(code: IndentedCodeBlock) { out.append(code.literal) }
            override fun visit(line: SoftLineBreak) { out.append(' ') }
            override fun visit(line: HardLineBreak) { out.append(' ') }
            override fun visit(html: HtmlBlock) { out.append(html.literal) }
            override fun visit(html: HtmlInline) { out.append(html.literal) }
        })
        return out.toString()
    }
    private class SafeLinks(private val context: HtmlNodeRendererContext, private val links: MutableList<ParsedLink>) : NodeRenderer {
        override fun getNodeTypes(): Set<Class<out Node>> = setOf(Link::class.java, Image::class.java)
        override fun render(node: Node) {
            if (node is Image) { context.writer.text("[Image omitted]"); return }
            val link = node as Link
            val key = "source-link-${links.size}"
            links += ParsedLink(key, link.destination)
            context.writer.tag("a", mapOf("href" to "#$key"))
            var child = node.firstChild
            while (child != null) { context.render(child); child = child.next }
            context.writer.tag("/a")
        }
    }
}
