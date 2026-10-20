package workbench.preparation.application

import workbench.preparation.api.PreparedItemData
import java.security.MessageDigest
import java.time.Instant

internal fun validOrigin(item: PreparedItemData): Boolean {
    val p = item.provenance
    val a = p.authored
    if (p.kind == "source") return p.capture != null && a == null
    if (p.kind != "authored" || p.capture != null || p.section != null || a == null || a.revision < 0) return false
    val card = item.capturedSource?.classification?.metadata ?: return false
    if (card.id != a.card || card.title != item.title || card.purpose != "session") return false
    try { if (Instant.parse(a.approvedAt).toString() != a.approvedAt) return false } catch (_: Exception) { return false }
    fun hash(s: String) = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    fun path(s: String?) = s != null && s.isNotBlank() && s.length <= 4096 && !s.startsWith('/') &&
        s.none { it == '\\' || it == ':' || it == '?' || it == '#' || it.isISOControl() } &&
        s.split('/').none { it.isEmpty() || it == "." || it == ".." } && s.endsWith(".md", true)
    fun frozenPath(s: String?) = s != null && s.isNotBlank() && s.length <= 4096 && !s.startsWith('/') &&
        '\\' !in s && s.split('/').none { it.isEmpty() || it == "." || it == ".." }
    if (!path(p.path)) return false
    if (a.original == null) {
        if (listOf(a.originalHash, a.originalCampaign, a.originalCapture, a.originalPath).any { it != null }) return false
    } else if (a.original.toByteArray(Charsets.UTF_8).size > 2 * 1024 * 1024 || a.originalHash != hash(a.original) ||
        a.originalCampaign == null || a.originalCapture == null || (a.originalPath.isNullOrBlank() || a.originalPath.length > 4096)) return false
    if (a.links.size > item.markdown.length) return false
    return a.links.all { link ->
        link.destination.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024 &&
        (link.anchor == null || link.anchor.length <= 2 * 1024 * 1024) &&
        (link.section == null || link.section.length <= 256) && when (link.kind) {
            "source" -> frozenPath(link.path) && link.capture != null && link.draft == null && link.revision == null
            "draft", "self" -> frozenPath(link.path) && link.capture == null && link.draft != null && link.revision != null && link.revision >= 0 &&
                (link.kind != "self" || (link.draft == a.draft && link.revision == a.revision))
            "local", "external", "unsupported", "ambiguous", "missing-document", "missing-anchor" -> link.capture == null &&
                (link.path == null || link.path.length <= 4096) && (link.revision == null || link.revision >= 0)
            else -> false
        }
    }
}
