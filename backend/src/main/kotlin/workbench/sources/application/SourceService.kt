package workbench.sources.application

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.raise.ensure
import arrow.core.raise.ensureNotNull
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sources.api.*
import workbench.sources.domain.*
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock

class SourceService(private val campaigns: Campaigns, private val store: CaptureStore, private val scanner: SourceScanner, private val markdown: Markdown, private val tx: Transactions) : Sources {
    override fun authoringLibrary(campaign: UUID): Either<Failure, AuthoringLibrary> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val captured = store.get(campaign)
        AuthoringLibrary(captured?.id, captured?.documents ?: emptyMap())
    } }
    private val locks = ConcurrentHashMap<UUID, ReentrantLock>()
    private fun parsed(capture: Capture): Map<String, ParsedDocument> {
        val documents = capture.documents.mapValues { markdown.parse(it.value) }
        val duplicates = documents.values.mapNotNull { it.declaredId }.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
        return documents.mapValues { (_, document) ->
            if (document.declaredId !in duplicates) document else document.copy(classification = SourceClassification(null,
                document.classification.issues + ClassificationIssue("metadata.duplicate-id", "id", "Card ID occurs in multiple documents in this campaign capture.")))
        }
    }
    private fun summaries(documents: Map<String, ParsedDocument>, filter: SourceFilter) = documents.toSortedMap()
        .filterValues { filter.matches(it.classification) }.map { (path, document) -> DocumentSummary(path, document.classification) }

    fun library(id: UUID, filter: SourceFilter = SourceFilter()): Either<Failure, Library> = tx.run { either {
        val campaign = campaigns.configuration(id).bind()
        val capture = store.get(id)
        Library(id, capture?.id, capture?.revision != campaign.revision, capture?.let { summaries(parsed(it), filter) } ?: emptyList())
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
                    Library(id, capture.id, false, summaries(parsed(capture), SourceFilter()))
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
        ensure(capture.documents.containsKey(path)) { Failure.NotFound("sources.document-not-found", "Document not found in this capture.") }
        val documents = parsed(capture)
        val parsed = documents.getValue(path)
        val relationships = relationships(path, parsed, documents)
        SourceDocument(id, version, path, parsed.sections, relationships.map { it.target }, parsed.classification, relationships)
    }
    override fun select(campaign: UUID, capture: UUID, path: String, section: String?): Either<Failure, SelectedSource> = tx.run { either {
        val current = capture(campaign, capture).bind()
        val text = ensureNotNull(current.documents[path]) { Failure.NotFound("sources.document-not-found", "Document not found in this capture.") }
        val documents = parsed(current)
        val parsed = documents.getValue(path)
        ensure(parsed.declaredPurpose !in setOf("guidance", "tooling")) {
            Failure.Invalid("sources.not-session-material", "Guidance and tooling documents cannot be added to a session.")
        }
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
        val selectedSections = parsed.ranges.filterValues { it.start >= offset && it.start < (range?.end ?: text.length) }.keys
        SelectedSource(campaign, capture, path, section, if (section == null) parsed.classification.metadata?.title ?: path else parsed.sections.first { it.id == section }.heading,
            selected, hash(text), hash(selected), anchors, parsed.classification,
            relationships(path, parsed, documents).filter { section == null || it.originSection in selectedSections },
            if (section == null) parsed.bodyStart else 0)
    } }
    fun search(id: UUID, version: UUID, query: String, filter: SourceFilter = SourceFilter()): Either<Failure, SearchResults> = either {
        val capture = capture(id, version).bind()
        val term = query.trim()
        val hits = if (term.isEmpty()) emptyList() else parsed(capture).toSortedMap().filterValues { filter.matches(it.classification) }.flatMap { (path, document) ->
            val metadata = document.classification.metadata
            val metadataMatch = metadata?.let { it.title.contains(term, true) || it.tags.any { tag -> tag.contains(term, true) } } == true
            val bodyHits = document.sections.flatMap { section ->
                section.blocks.filter { it.text.contains(term, true) || section.heading.contains(term, true) || path.contains(term, true) }.map { block ->
                    val index = block.text.indexOf(term, ignoreCase = true).coerceAtLeast(0)
                    val start = (index - 60).coerceAtLeast(0)
                    SearchHit(path, section.id, section.heading, block.id, block.text.substring(start, minOf(block.text.length, start + 220)), document.classification)
                }
            }
            if (bodyHits.isNotEmpty() || !metadataMatch) bodyHits else {
                val section = document.sections.first()
                listOf(SearchHit(path, section.id, section.heading, section.blocks.first().id, metadata.title, document.classification))
            }
        }
        SearchResults(id, version, hits)
    }
    private fun relationships(origin: String, document: ParsedDocument, documents: Map<String, ParsedDocument>) = document.links.map { link ->
        val target = resolveLink(origin, link, documents)
        val classification = target.document?.let { documents[it]?.classification }
        val metadata = classification?.metadata
        SourceRelationship(link.key, link.originSection, link.destination, target, classification,
            !target.missing && metadata?.type == "scene" && metadata.purpose == "session")
    }
    private fun resolveLink(origin: String, link: ParsedLink, documents: Map<String, ParsedDocument>): SourceLink =
        resolveCapturedLink(origin, link, documents)
}
