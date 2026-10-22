package workbench.writing.application

import workbench.writing.api.*
import workbench.sources.api.*
import java.time.Instant
import java.net.URI
import java.util.UUID

/** No live source lookup: old links and hashes are historical evidence, not restored authority. */
internal class RecoveryValidation(private val authoring: Authoring) {
    fun encoded(d: DraftData) = d.fields.let { authoring.encode(AuthoredDocument(d.card, it.title, it.type, it.status, it.tags, it.summary, it.body), d.origin?.retainedEnvelope.orEmpty()) }
    fun validate(a: WritingArchive) {
        require(a.format == "workbench-writing-recovery" && a.version in setOf(1, 2))
        require(a.name.isNotBlank() && a.name.length <= 200)
        time(a.savedAt)
        require(a.drafts.size <= 1000 && a.approved.size + a.exports.size <= 10000)
        require(a.drafts.map { it.id }.distinct().size == a.drafts.size)
        require(a.approved.map { it.snapshot.id to it.snapshot.revision }.distinct().size == a.approved.size)
        require(a.exports.map { it.id }.distinct().size == a.exports.size)
        require(a.exports.groupingBy { it.snapshot.id }.eachCount().values.all { it <= 1000 })
        val snapshots = a.drafts + a.approved.map { it.snapshot } + a.exports.map { it.snapshot }
        require(a.version == 2 || snapshots.all { it.image == null })
        snapshots.distinct().forEach { d ->
            require(d.campaign == a.campaign && d.revision >= 0 && withinWorkingLimits(d.fields))
            d.recovery?.let { require(it.revision >= 0) }
            d.origin?.let { o ->
                require(o.interpretation == 1 && text(o.raw, 2 * 1024 * 1024) && o.hash == contentHash(o.raw) && text(o.retainedEnvelope, 65536))
                require(o.path.isNotBlank() && o.path.length <= 4096 && o.issues.size <= 4096 && o.issues.all { text(it, 65536) })
                val decoded = authoring.decode(o.raw)
                require(decoded.errors.isEmpty() && decoded.retainedEnvelope == o.retainedEnvelope && decoded.card == o.card)
            }
        }
        snapshots.groupBy { it.id }.values.forEach { history ->
            require(history.map { it.card }.distinct().size == 1)
            history.groupBy { it.revision }.values.forEach { require(it.distinct().size == 1) }
        }
        require(snapshots.groupBy { it.card }.values.all { list -> list.map { it.id }.distinct().size == 1 })
        val current = a.drafts.associateBy { it.id }
        require(snapshots.all { current[it.id]?.revision?.let { revision -> it.revision <= revision } != false })
        val byRevision = snapshots.associateBy { it.id to it.revision }
        fun links(d: DraftData, links: List<CheckedLink>, capture: UUID?) {
            val parsed = encoded(d).preview
            require(links.size == parsed.links.size)
            // Destination order is taken from the same in-memory interpretation used by Writing.
            val interpreted = authoring.links(d.fields.path, d.fields.body, emptyMap(), emptyList(), d.id)
            require(links.map { it.destination } == interpreted.map { it.destination })
            links.forEachIndexed { i, l ->
                require(l.key == "source-link-$i" && text(l.destination) && (l.warning == null || text(l.warning)))
                require(l.path == null || l.path.length <= 4096)
                require(l.anchor == null || text(l.anchor))
                require(l.section == null || l.section.length <= 256)
                require(l.revision == null || l.revision >= 0)
                when (l.kind) {
                    "source" -> require(capture != null && l.path != null && l.draft == null && l.revision == null && l.external == null)
                    "draft", "self" -> {
                        require(l.draft != null && l.revision != null && l.path != null && l.external == null)
                        if (l.kind == "self") require(l.draft == d.id && l.revision == d.revision)
                        byRevision[l.draft to l.revision]?.let { target ->
                            require(target.fields.path == l.path && (l.anchor == null || l.anchor in encoded(target).preview.anchors))
                        }
                    }
                    "local" -> require(l.draft == null && l.revision == null && l.external == null && (l.anchor == null || l.anchor in parsed.anchors))
                    "external" -> {
                        val uri = URI(l.destination.replace(" ", "%20"))
                        require(uri.scheme?.lowercase() in setOf("http", "https") && uri.host != null && l.external == uri.toASCIIString() && l.draft == null && l.revision == null)
                    }
                    "unsupported", "ambiguous", "missing-document", "missing-anchor" -> require(l.external == null)
                    else -> error("Unknown link kind")
                }
                // The URI interpreter must still agree on safety, path and anchor; source availability may have changed.
                val known = interpreted[i]
                require(l.path == known.path && l.anchor == known.anchor)
                if (known.kind in setOf("unsupported", "external", "local")) require(l.kind == known.kind)
            }
        }
        fun ready(d: DraftData, markdown: String, hash: String, limit: Int) {
            require(text(markdown, limit) && hash == contentHash(markdown) && exportPathErrors(d.fields.path).isEmpty())
            val e = encoded(d)
            require(e.errors.isEmpty() && e.preview.classification.metadata?.purpose == "session" && e.preview.classification.issues.none { it.severity == "error" } && e.markdown == markdown)
        }
        a.approved.forEach { r -> ready(r.snapshot, r.markdown, r.hash, 2 * 1024 * 1024); links(r.snapshot, r.links, r.capture) }
        a.exports.forEach { e ->
            time(e.createdAt)
            val r = e.report
            require(r.revision == e.snapshot.revision && r.path == e.snapshot.fields.path && r.errors.isEmpty() && r.fingerprint.matches(Regex("[a-f0-9]{64}")))
            require(r.warnings.size <= 100000 && r.warnings.all { text(it) } && (r.warnings.isEmpty() || e.acknowledged))
            require(r.targetRevisions.size <= 1000 && r.targetRevisions.all { (id, revision) -> UUID.fromString(id).toString() == id && revision >= 0 })
            ready(e.snapshot, r.markdown, r.hash, 3 * 1024 * 1024)
            links(e.snapshot, r.links, r.capture)
        }
    }
    private fun text(s: String, limit: Int = 2 * 1024 * 1024) = s.toByteArray(Charsets.UTF_8).size <= limit
    private fun time(s: String) { require(Instant.parse(s).toString() == s) }
}
