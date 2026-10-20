package workbench.sources.application

import java.net.URI
import workbench.sources.api.SourceLink

internal data class LinkDestination(val path: String? = null, val anchor: String? = null, val external: String? = null, val valid: Boolean = false, val local: Boolean = false)

internal fun linkDestination(origin: String, destination: String): LinkDestination = try {
    val uri = URI(destination.replace(" ", "%20"))
    if (uri.isAbsolute) {
        if (uri.scheme.lowercase() in setOf("http", "https") && uri.host != null) LinkDestination(external = uri.toASCIIString(), valid = true) else LinkDestination()
    } else if (uri.authority != null || uri.query != null || uri.path.orEmpty().startsWith('/') || '\\' in uri.path.orEmpty()) LinkDestination()
    else {
        val local = uri.path.orEmpty()
        val segments = if (local.isEmpty()) origin.split('/').toMutableList() else origin.substringBeforeLast('/', "").split('/').filter { it.isNotEmpty() }.toMutableList()
        var escaped = false
        if (local.isNotEmpty()) for (part in local.split('/')) when (part) {
            "", "." -> Unit
            ".." -> if (segments.isEmpty()) escaped = true else segments.removeAt(segments.lastIndex)
            else -> segments.add(part)
        }
        if (escaped) LinkDestination() else LinkDestination(segments.joinToString("/"), uri.fragment?.takeIf { it.isNotEmpty() }, valid = true, local = local.isEmpty())
    }
} catch (_: Exception) { LinkDestination() }

internal fun resolveCapturedLink(origin: String, link: ParsedLink, documents: Map<String, ParsedDocument>): SourceLink {
    val d = linkDestination(origin, link.destination)
    fun missing() = SourceLink(link.key, null, null, null, true)
    if (!d.valid) return missing()
    if (d.external != null) return SourceLink(link.key, null, null, d.external, false)
    val target = documents[d.path] ?: return missing()
    val section = d.anchor?.let { target.anchors[it] ?: return missing() }
    return SourceLink(link.key, d.path, section, null, false)
}
