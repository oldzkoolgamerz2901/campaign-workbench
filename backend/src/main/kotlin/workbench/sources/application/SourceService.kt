package workbench.sources.application

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.raise.ensure
import arrow.core.raise.ensureNotNull
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sources.api.*
import workbench.sources.domain.*
import java.net.URI
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock

class SourceService(private val campaigns: Campaigns, private val store: CaptureStore, private val scanner: SourceScanner, private val markdown: Markdown, private val tx: Transactions) : Sources {
    private val locks = ConcurrentHashMap<UUID, ReentrantLock>()
    fun library(id: UUID): Either<Failure, Library> = tx.run { either {
        val campaign = campaigns.configuration(id).bind()
        val capture = store.get(id)
        Library(id, capture?.id, capture?.revision != campaign.revision, capture?.documents?.keys?.sorted()?.map(::DocumentSummary) ?: emptyList())
    } }
    fun refresh(id: UUID): Either<Failure, Library> {
        val lock = locks.computeIfAbsent(id) { ReentrantLock() }
        if (!lock.tryLock()) return Either.Left(Failure.Conflict("sources.refresh-in-progress", "A refresh is already running for this campaign."))
        try {
            return either {
                val config = campaigns.configuration(id).bind()
                val texts = scanner.scan(SourceScope(id, config.directory, config.includes, config.excludes, config.revision)).bind()
                // Validate parsing before publication; malformed/over-complex input cannot replace a usable capture.
                try { texts.values.forEach { markdown.parse(it) } } catch (_: Exception) { raise(Failure.Unreadable("sources.markdown", "Could not parse the complete library. Previous capture preserved.")) }
                tx.run { either {
                    val latest = campaigns.configuration(id).bind()
                    ensure(latest.revision == config.revision) { Failure.Conflict("sources.configuration-changed", "Source rules changed during refresh. Refresh again.") }
                    val capture = Capture(id, UUID.randomUUID(), config.revision, texts)
                    store.publish(capture)
                    Library(id, capture.id, false, texts.keys.sorted().map(::DocumentSummary))
                } }.bind()
            }
        } finally { lock.unlock() }
    }
    private fun capture(id: UUID, version: UUID): Either<Failure, Capture> = tx.run { either {
        campaigns.configuration(id).bind()
        val current = ensureNotNull(store.get(id)) { Failure.NotFound("sources.no-capture", "Refresh the campaign to load its sources.") }
        ensure(current.id == version) { Failure.Conflict("sources.capture-replaced", "The library was refreshed. Reload it before continuing.") }
        current
    } }
    fun document(id: UUID, version: UUID, path: String): Either<Failure, SourceDocument> = either {
        val capture = capture(id, version).bind()
        val text = ensureNotNull(capture.documents[path]) { Failure.NotFound("sources.document-not-found", "Document not found in this capture.") }
        val parsed = markdown.parse(text)
        SourceDocument(id, version, path, parsed.sections, parsed.links.map { link -> resolveLink(path, link, capture) })
    }
    override fun select(campaign: UUID, capture: UUID, path: String, section: String?): Either<Failure, SelectedSource> = tx.run { either {
        val current = capture(campaign, capture).bind()
        val text = ensureNotNull(current.documents[path]) { Failure.NotFound("sources.document-not-found", "Document not found in this capture.") }
        val parsed = markdown.parse(text)
        val range = if (section == null) null else ensureNotNull(parsed.ranges[section]) { Failure.NotFound("sources.section-not-found", "Section not found in this capture.") }
        val selected = if (range == null) text else text.substring(range.start, range.end)
        fun hash(value: String) = java.security.MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        val offset = range?.start ?: 0
        val frozen = markdown.parse(selected)
        val anchors = parsed.anchors.mapNotNull { (slug, sectionId) ->
            val start = parsed.ranges[sectionId]?.start ?: return@mapNotNull null
            if (start < offset || start >= (range?.end ?: text.length)) return@mapNotNull null
            val localId = "s-${start - offset}"
            frozen.anchors.entries.firstOrNull { it.value == localId }?.let { slug to it.key }
        }.toMap()
        SelectedSource(campaign, capture, path, section, if (section == null) path else parsed.sections.first { it.id == section }.heading, selected, hash(text), hash(selected), anchors)
    } }
    fun search(id: UUID, version: UUID, query: String): Either<Failure, SearchResults> = either {
        val capture = capture(id, version).bind()
        val term = query.trim()
        val hits = if (term.isEmpty()) emptyList() else capture.documents.toSortedMap().flatMap { (path, text) ->
            markdown.parse(text).sections.flatMap { section ->
                section.blocks.filter { it.text.contains(term, true) || section.heading.contains(term, true) || path.contains(term, true) }.map { block ->
                    val index = block.text.indexOf(term, ignoreCase = true).coerceAtLeast(0)
                    val start = (index - 60).coerceAtLeast(0)
                    SearchHit(path, section.id, section.heading, block.id, block.text.substring(start, minOf(block.text.length, start + 220)))
                }
            }
        }
        SearchResults(id, version, hits)
    }
    private fun resolveLink(origin: String, link: ParsedLink, capture: Capture): SourceLink {
        fun missing() = SourceLink(link.key, null, null, null, true)
        return try {
            val uri = URI(link.destination.replace(" ", "%20"))
            if (uri.isAbsolute) {
                if (uri.scheme.lowercase() in setOf("https", "http")) SourceLink(link.key, null, null, uri.toASCIIString(), false) else missing()
            } else {
                if (uri.authority != null || uri.query != null) return missing()
                val local = uri.path.orEmpty()
                if (local.startsWith('/') || '\\' in local) return missing()
                val segments = if (local.isEmpty()) origin.split('/').toMutableList() else (origin.substringBeforeLast('/', "").split('/').filter { it.isNotEmpty() }).toMutableList().apply {
                    for (segment in local.split('/')) when (segment) {
                        "", "." -> Unit
                        ".." -> { if (isEmpty()) return missing(); removeAt(lastIndex) }
                        else -> add(segment)
                    }
                }
                val path = segments.joinToString("/")
                val target = capture.documents[path] ?: return missing()
                val section = if (uri.fragment.isNullOrEmpty()) null else markdown.parse(target).anchors[uri.fragment] ?: return missing()
                SourceLink(link.key, path, section, null, false)
            }
        } catch (_: Exception) { missing() }
    }
}
