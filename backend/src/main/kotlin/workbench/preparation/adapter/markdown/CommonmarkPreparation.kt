package workbench.preparation.adapter.markdown

import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.node.*
import org.commonmark.parser.Parser
import org.commonmark.renderer.NodeRenderer
import org.commonmark.renderer.html.*
import org.springframework.stereotype.Component
import workbench.preparation.application.PreparationMarkdown
import workbench.preparation.api.*
import java.net.URI
import java.util.Locale
import workbench.preparation.domain.PreparedItem

@Component
class CommonmarkPreparation : PreparationMarkdown {
    private val extensions = listOf(TablesExtension.create())
    private val parser = Parser.builder().extensions(extensions).build()
    override fun render(text: String) = renderWith(text, null, emptyList())
    override fun captured(items: List<PreparedItem>) = items.associate { it.id to renderWith(it.markdown.substring(it.capturedSource?.bodyStart ?: 0), it, items) }
    private fun renderWith(text: String, origin: PreparedItem?, items: List<PreparedItem>): RenderedMarkdown {
        val root = parser.parse(text)
        val anchors = mutableSetOf<String>()
        root.accept(object : AbstractVisitor() {
            override fun visit(heading: Heading) {
                val plain = StringBuilder()
                heading.accept(object : AbstractVisitor() {
                    override fun visit(t: Text) { plain.append(t.literal) }
                    override fun visit(c: Code) { plain.append(c.literal) }
                })
                val base = plain.toString().lowercase(Locale.ROOT).replace(Regex("""[^\p{L}\p{N}_ -]"""), "").replace(' ', '-').ifBlank { "section" }
                var slug = base; var suffix = 1
                while (!anchors.add(slug)) slug = "$base-${suffix++}"
            }
        })
        val links = mutableListOf<RenderedLink>()
        val renderer = HtmlRenderer.builder().extensions(extensions).escapeHtml(true).sanitizeUrls(true)
            .nodeRendererFactory { context -> object : NodeRenderer {
                override fun getNodeTypes(): Set<Class<out Node>> = setOf(Link::class.java, Image::class.java, Heading::class.java)
                private fun children(node: Node) { var c = node.firstChild; while (c != null) { context.render(c); c = c.next } }
                override fun render(node: Node) {
                    when (node) {
                        is Image -> context.writer.text("[Image omitted]")
                        is Heading -> { context.writer.tag("h${node.level}"); children(node); context.writer.tag("/h${node.level}") }
                        is Link -> {
                            val uri = try { URI(node.destination.replace(" ", "%20")) } catch (_: Exception) { null }
                            val external = uri?.takeIf { it.scheme?.lowercase() in setOf("http", "https") && it.host != null }?.toASCIIString()
                            val target = if (origin == null) uri?.takeIf { !it.isAbsolute && it.authority == null && it.path.orEmpty().isEmpty() && it.query == null }?.fragment?.takeIf { it in anchors }
                                else if (origin.provenance.kind == "authored") authoredTarget(uri, node.destination, origin, items, links.size) else capturedTarget(uri, origin, items)
                            val key = "prepared-link-${links.size}"
                            links += RenderedLink(key, target, external, target == null && external == null)
                            context.writer.tag("a", mapOf("href" to "#$key")); children(node); context.writer.tag("/a")
                            if (target == null && external == null) context.writer.text(" [outside captured material]")
                        }
                    }
                }
            } }.build()
        return RenderedMarkdown(anchors.toList(), renderer.render(root), links)
    }
    private fun authoredTarget(uri: URI?, destination: String, origin: PreparedItem, items: List<PreparedItem>, index: Int): String? {
        if (uri == null || uri.isAbsolute || uri.authority != null || uri.query != null ||
            uri.path.orEmpty().startsWith('/') || '\\' in uri.path.orEmpty()) return null
        val authored = origin.provenance.authored ?: return null
        val link = authored.links.getOrNull(index)?.takeIf { it.destination == destination } ?: return null
        val candidates = when (link.kind) {
            "local", "self" -> listOf(origin)
            "source" -> items.filter { it.provenance.kind == "source" && it.provenance.campaign == origin.provenance.campaign &&
                it.provenance.capture == link.capture && it.provenance.path == link.path &&
                (if (link.anchor == null) it.provenance.section == null else link.anchor in it.anchors) }
            "draft" -> items.filter { it.provenance.kind == "authored" && it.provenance.campaign == origin.provenance.campaign &&
                it.provenance.authored?.draft == link.draft && it.provenance.authored?.revision == link.revision }
            else -> emptyList()
        }
        val target = candidates.firstOrNull() ?: return null
        val anchor = link.anchor?.let { target.anchors[it] ?: return null }.orEmpty()
        return if (target.id == origin.id && anchor.isNotEmpty()) anchor else "@${target.id}#$anchor"
    }
    private fun capturedTarget(uri: URI?, origin: PreparedItem, items: List<PreparedItem>): String? {
        if (uri == null || uri.isAbsolute || uri.authority != null || uri.query != null) return null
        val local = uri.path.orEmpty()
        if (local.startsWith('/') || '\\' in local) return null
        val segments = origin.provenance.path.substringBeforeLast('/', "").split('/').filter { it.isNotEmpty() }.toMutableList()
        if (local.isNotEmpty()) for (s in local.split('/')) when (s) {
            "", "." -> Unit
            ".." -> { if (segments.isEmpty()) return null; segments.removeAt(segments.lastIndex) }
            else -> segments.add(s)
        }
        val path = if (local.isEmpty()) origin.provenance.path else segments.joinToString("/")
        val candidates = listOf(origin) + items.filter { it.id != origin.id }
        val target = candidates.firstOrNull { i -> i.provenance.kind == "source" && i.provenance.campaign == origin.provenance.campaign && i.provenance.capture == origin.provenance.capture && i.provenance.path == path &&
            (if (uri.fragment.isNullOrEmpty()) i.provenance.section == null else uri.fragment in i.anchors) } ?: return null
        val anchor = uri.fragment?.let { target.anchors[it] }.orEmpty()
        return if (target.id == origin.id && anchor.isNotEmpty()) anchor else "@${target.id}#$anchor"
    }
}
