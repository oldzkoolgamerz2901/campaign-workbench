package workbench.writing.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sources.api.*
import workbench.writing.api.*
import workbench.writing.domain.*
import java.util.UUID

/** Read composition and associated editing stay with Writing; Sources owns capture interpretation. */
class CardLibraryService(
    private val campaigns: Campaigns, private val sources: Sources, private val authoring: Authoring,
    private val drafts: DraftStore, private val associations: SourceAssociationStore,
    private val exports: ExportStore, private val tx: Transactions, private val layouts: CardLayoutCalculator
) : CardLibraries {
    private data class View(val entry: LibraryEntry, val sources: List<CatalogueSource>, val draft: Draft?, val preview: DraftPreview?)
    private data class Snapshot(val capture: UUID?, val views: List<View>)
    internal data class LinkResolution(val capture: UUID?, val links: List<CheckedLink>, val targetRevisions: Map<String, Long>, val sourcePaths: Set<String>)
    private fun encoded(d: Draft) = authoring.encode(AuthoredDocument(d.card, d.title, d.type, d.status, d.tags, d.summary, d.body, d.backText, d.encoding), d.origin?.retainedEnvelope.orEmpty())
    private fun targets(snapshot: Snapshot, origin: Draft? = null) = snapshot.views.map { view ->
        val d = if (view.draft?.id == origin?.id) origin else view.draft
        AuthoredLinkTarget(view.entry.key,
            (view.entry.sources.map { it.path } + listOfNotNull(d?.path)).toSet(),
            d?.let { encoded(it).markdown } ?: view.sources.firstOrNull()?.raw.orEmpty(),
            d?.id, d?.revision, view.entry.conflicts.isNotEmpty())
    }
    internal fun resolveLinks(campaign: UUID, origin: Draft): Either<Failure, LinkResolution> = tx.run { either {
        resolve(snapshot(campaign).bind(), origin.path, encoded(origin).markdown, origin.id, origin)
    } }
    private fun resolve(snapshot: Snapshot, path: String, raw: String, own: UUID, origin: Draft? = null): LinkResolution {
        val targets = targets(snapshot, origin)
        val captured = snapshot.views.flatMap { it.sources }.associate { it.path to it.raw }
        val links = authoring.resolvedLinks(path, raw, targets, own).map { link ->
            val target = targets.singleOrNull { it.draft == link.draft && link.draft != null }
            if (target == null || link.kind !in setOf("draft", "self") || (link.kind == "self" && link.path == path)) link
            else link.copy(warning = when {
                captured[link.path] == target.markdown -> null
                link.path !in captured -> "${link.path} opens Draft revision ${link.revision}, but no captured campaign file exists there. Export/incorporate the target for a portable link."
                else -> "${link.path} opens Draft revision ${link.revision}; the captured campaign file differs. Export/incorporate the target to reproduce the effective content."
            })
        }
        val relevant = links.mapNotNull { it.path }.toSet() + path
        val revisions = targets.filter { it.draft != null && it.draft != own && it.paths.any { alias -> alias in relevant } }
            .sortedBy { it.draft }.associate { it.draft.toString() to it.revision!! }
        return LinkResolution(snapshot.capture, links, revisions, captured.keys)
    }
    private fun key(card: UUID?, path: String) = card?.let { "card:$it" } ?: "source:$path"
    private fun conflict() = Failure.Conflict("writing.identity-conflict", "Conflicting Source/card identities require explicit resolution before editing or preparing this card.")

    private fun snapshot(campaign: UUID): Either<Failure, Snapshot> = either {
        campaigns.configuration(campaign).bind()
        val captured = sources.catalogue(campaign).bind()
        val bindings = associations.list(campaign).toMutableList()
        // Resolve unique declared identities before testing path conflicts. A typed card can move
        // and another card can reuse its old path; a path is only a locator, not its identity.
        val declared = captured.documents.filter { it.declaredId != null }.groupBy { it.declaredId }
        val relocated = bindings.map { binding ->
            declared[binding.card]?.singleOrNull()?.let { binding.copy(path = it.path, declaredId = it.declaredId) } ?: binding
        }
        val pathClaims = relocated.groupBy { it.path }
        relocated.forEachIndexed { index, binding ->
            if (binding != bindings[index] && pathClaims[binding.path]?.size == 1) {
                associations.put(campaign, binding); bindings[index] = binding
            }
        }
        val bindingsByPath = bindings.groupBy { it.path }
        val bindingsByCard = bindings.associateBy { it.card }.toMutableMap()
        val working = drafts.list(campaign)
        val conflicts = mutableMapOf<String, MutableSet<String>>()
        fun mark(k: String, message: String) { conflicts.getOrPut(k) { linkedSetOf() }.add(message) }
        val grouped = captured.documents.groupBy { source ->
            val atPath = bindingsByPath[source.path].orEmpty()
            val claims = (atPath.map { it.card } + listOfNotNull(source.declaredId)).distinct()
            val k = key(source.declaredId ?: atPath.singleOrNull()?.card, source.path)
            if (claims.size > 1 || atPath.any { it.declaredId != null && source.declaredId != it.declaredId }) {
                val message = "Source identity at ${source.path} conflicts with its explicit association."
                mark(k, message); claims.forEach { mark(key(it, ""), message) }
            }
            k
        }
        grouped.forEach { (k, values) -> if (values.size > 1) mark(k, "Multiple captured Sources claim this logical card identity.") }
        val draftGroups = working.groupBy { key(it.card, "") }
        draftGroups.forEach { (k, values) -> if (values.size > 1) mark(k, "Multiple working Drafts claim this logical card identity.") }
        // Retain unique observed UUID associations in Writing. Otherwise a later refresh that
        // removes an exported Source would erase all evidence that it had been incorporated.
        grouped.forEach { (k, material) ->
            val d = draftGroups[k]?.singleOrNull()
            val source = material.singleOrNull()
            if (d != null && source?.declaredId == d.card && conflicts[k].isNullOrEmpty() && d.card !in bindingsByCard) {
                if (bindings.size >= 10000) mark(k, "Source association evidence exceeds the campaign limit.")
                else {
                    val binding = SourceAssociationData(d.card, source.path, source.declaredId, captured.capture!!, source.hash)
                    associations.put(campaign, binding); bindings.add(binding); bindingsByCard[d.card] = binding
                }
            }
        }
        val views = (grouped.keys + draftGroups.keys).map { k ->
            val material = grouped[k].orEmpty()
            val d = draftGroups[k]?.singleOrNull()
            val binding = (d?.card ?: material.firstOrNull()?.declaredId)?.let { bindingsByCard[it] }
                ?: material.firstOrNull()?.let { bindingsByPath[it.path]?.singleOrNull() }
            val encoded = d?.let { authoring.encode(AuthoredDocument(it.card, it.title, it.type, it.status, it.tags, it.summary, it.body, it.backText, it.encoding), it.origin?.retainedEnvelope.orEmpty()) }
            val baseClassification = encoded?.preview?.classification ?: material.first().document.classification
            val logical = d?.card ?: material.firstOrNull()?.declaredId ?: binding?.card
            val issues = conflicts[k].orEmpty().toList()
            val classification = baseClassification.copy(issues = baseClassification.issues + issues.map { ClassificationIssue("writing.identity-conflict", "id", it) })
            val sourceStates = material.map { source ->
                val baseline = binding?.hash
                val exported by lazy { d?.let { exports.list(campaign, it.id) }.orEmpty() }
                val state = when {
                    issues.isNotEmpty() -> "conflict"
                    baseline == source.hash || exported.any { it.hash == source.hash } -> "current"
                    baseline != null || exported.isNotEmpty() -> "changed"
                    else -> "available"
                }
                LibrarySourceState(source.path, captured.capture, source.declaredId, state, source.hash)
            }.ifEmpty { binding?.let { listOf(LibrarySourceState(it.path, null, it.declaredId, if (issues.isEmpty()) "unavailable" else "conflict", null)) }.orEmpty() }
            val title = d?.title?.takeIf { it.isNotBlank() } ?: d?.path ?: classification.metadata?.title ?: material.first().path
            val metadata = classification.metadata
            val layout = layouts.layout(metadata?.layoutInput() ?: CardLayoutInput(d?.title ?: metadata?.title.orEmpty(), d?.type ?: metadata?.type.orEmpty(), d?.summary ?: metadata?.summary.orEmpty(), d?.tags ?: metadata?.tags.orEmpty(), d?.backText ?: metadata?.backText.orEmpty()))
            val fitIssues = layout.front.issues + layout.back.issues
            val ready = layout.front.fits && layout.back.fits && issues.isEmpty() && classification.metadata?.purpose == "session" && classification.issues.none { it.severity == "error" } &&
                if (d == null) material.singleOrNull()?.let { source ->
                    source.raw.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024 && exportPathErrors(source.path).isEmpty() && authoring.decode(source.raw).errors.isEmpty()
                } == true else encoded!!.errors.isEmpty() && exportPathErrors(d.path).isEmpty() && encoded.markdown.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024
            View(LibraryEntry(k, logical, d?.id, d?.revision, title, classification, d?.image, sourceStates, issues, ready, fitIssues), material, d,
                encoded?.let { DraftPreview(it.preview, exportPathErrors(d.path), capture = captured.capture, layout = layout) })
        }.sortedWith(compareBy({ it.entry.title.lowercase(java.util.Locale.ROOT) }, { it.entry.key }))
        Snapshot(captured.capture, views)
    }

    override fun list(campaign: UUID, query: String, filter: SourceFilter): Either<Failure, CardLibrary> = tx.run { either {
        val view = snapshot(campaign).bind()
        val term = query.trim()
        CardLibrary(campaign, view.capture, view.views.filter { item ->
            filter.matches(item.entry.classification) && (term.isEmpty() || buildString {
                append(item.entry.title); append(' ')
                val metadata = item.entry.classification.metadata
                append(metadata?.backText.orEmpty()); append(' '); append(metadata?.tags?.joinToString(" ").orEmpty()); append(' '); append(metadata?.summary.orEmpty())
                // Search the effective Draft only; the original Source is available in Details.
                val sections = item.preview?.preview?.sections ?: item.sources.flatMap { it.document.sections }
                sections.forEach { section -> append(' '); append(section.heading); section.blocks.forEach { append(' '); append(it.text) } }
                if (item.draft != null) { append(' '); append(item.draft.path) }
                else item.sources.forEach { source ->
                    append(' '); append(source.path)
                    // Duplicate identities suppress classification metadata. Keep each claimant's
                    // searchable labels without promoting one to authoritative classification.
                    val decoded = authoring.decode(source.raw)
                    append(' '); append(decoded.title)
                    append(' '); append(decoded.tags.joinToString(" "))
                    append(' '); append(decoded.summary)
                }
            }.contains(term, ignoreCase = true))
        }.map { it.entry })
    } }

    override fun document(campaign: UUID, key: String, capture: UUID?, revision: Long?, sourcePath: String?, draft: UUID?, linkPath: String?): Either<Failure, LibraryDocument> = tx.run { either {
        val view = snapshot(campaign).bind()
        ensure(view.capture == capture) { Failure.Conflict("sources.capture-replaced", "Captured library changed. Reload the catalogue before reading.") }
        val item = ensureNotNull(view.views.find { it.entry.key == key }) { Failure.NotFound("writing.library-not-found", "Library card is unavailable.") }
        if (linkPath != null) {
            // The URI interpreter supplies a decoded locator, which can contain encoded filename
            // punctuation. Reading does not impose the stricter finished-export placement rules.
            ensure(linkPath.isNotBlank() && linkPath.length <= 4096 && !linkPath.startsWith('/') &&
                '\\' !in linkPath && linkPath.none { it.isISOControl() } &&
                linkPath.split('/').none { it.isEmpty() || it == "." || it == ".." }) {
                Failure.Invalid("writing.link-path", "Link locator must be a safe campaign-relative path.")
            }
            val claims = view.views.filter { target -> target.draft?.path == linkPath || target.entry.sources.any { it.path == linkPath } }
            ensure(claims.size == 1 && claims.single().entry.key == key && item.entry.conflicts.isEmpty()) {
                Failure.Conflict("writing.link-target-changed", "Link target has conflicting or changed Library paths. Reload the selected document or preview.")
            }
        }
        ensure(item.draft?.id == draft && item.draft?.revision == revision) {
            Failure.Conflict("writing.stale-revision", "Draft identity or saved revision changed. Reload the catalogue before reading.")
        }
        val selected = if (sourcePath == null) item.sources.singleOrNull() else
            ensureNotNull(item.sources.find { it.path == sourcePath }) { Failure.NotFound("writing.library-not-found", "Choose a Source belonging to this card.") }
        ensure(item.draft != null || selected != null) { Failure.Conflict("writing.source-choice-required", "Choose an explicit Source path to inspect conflicting identity claims.") }
        val raw = item.draft?.let { encoded(it).markdown } ?: selected!!.raw
        val links = resolve(view, item.draft?.path ?: selected!!.path, raw, item.draft?.id ?: UUID(0, 0)).links
        val preview = item.preview?.copy(checkedLinks = links)
        LibraryDocument(item.entry, item.draft?.body ?: selected!!.raw,
            selected?.document, preview, item.draft?.let(::draftData), adventureChoices(view, item), links)
    } }

    /** Resolve locators through unified identities, using the effective saved body at every alias. */
    private fun adventureChoices(snapshot: Snapshot, origin: View): List<AdventureChoice> {
        if (origin.entry.classification.metadata?.type != "adventure") return emptyList()
        val paths = snapshot.views.flatMap { target ->
            (target.entry.sources.map { it.path } + listOfNotNull(target.draft?.path)).distinct().map { it to target }
        }.groupBy({ it.first }, { it.second })
        val path = origin.draft?.path ?: origin.sources.singleOrNull()?.path ?: return emptyList()
        val raw = origin.draft?.let { encoded(it).markdown } ?: origin.sources.single().raw
        return resolve(snapshot, path, raw, origin.draft?.id ?: UUID(0, 0)).links
            .filter { it.kind !in setOf("external", "local", "self") && it.path != path }
            .mapNotNull { link ->
                val targets = paths[link.path].orEmpty()
                val target = targets.singleOrNull()?.entry
                if (target != null && target.classification.metadata?.type != "scene" && target.ready) null
                else AdventureChoice(link.destination, target, when {
                    targets.size > 1 -> "Several Library cards claim this path. Resolve the conflict."
                    target == null -> "Linked material is unavailable or unsupported."
                    target.conflicts.isNotEmpty() -> "Linked card has an identity conflict."
                    target.classification.metadata?.type != "scene" || !target.ready -> "Linked card is not a valid preparable Scene."
                    link.kind !in setOf("source", "draft", "self") -> link.warning ?: "Linked target is unavailable."
                    else -> null
                })
            }.distinctBy { it.entry?.key ?: it.destination }
    }

    override fun editSource(campaign: UUID, request: EditLibrarySource): Either<Failure, DraftData> = tx.run { either {
        val view = snapshot(campaign).bind()
        ensure(view.capture == request.capture) { Failure.Conflict("sources.capture-replaced", "Captured library changed. Reload before editing.") }
        val item = ensureNotNull(view.views.find { v -> v.sources.any { it.path == request.path } }) { Failure.NotFound("writing.library-not-found", "Source is unavailable in this capture.") }
        ensure(item.entry.conflicts.isEmpty()) { conflict() }
        item.draft?.let { return@either draftData(it) }
        val selected = item.sources.single()
        val decoded = authoring.decode(selected.raw)
        ensure(decoded.errors.isEmpty() && selected.raw.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024 && decoded.retainedEnvelope.toByteArray(Charsets.UTF_8).size <= 65536) {
            Failure.Invalid("writing.source-invalid", "Source cannot be copied safely or exceeds retained-source limits. Original remains readable.")
        }
        ensure(drafts.list(campaign).size < 1000) { Failure.Invalid("writing.draft-limit", "Campaign has reached the 1,000 Draft limit.") }
        val bindings = associations.list(campaign)
        val card = item.entry.card ?: UUID.randomUUID()
        ensure(bindings.any { it.card == card } || bindings.size < 10000) { Failure.Invalid("writing.association-limit", "Campaign has reached the 10,000 Source association limit.") }
        val origin = DraftOrigin(campaign, request.capture, selected.path, selected.declaredId, selected.raw, selected.hash, decoded.retainedEnvelope, decoded.issues, 2)
        val draft = Draft(UUID.randomUUID(), campaign, card, 0, decoded.title, decoded.type, "draft", decoded.tags, decoded.summary, decoded.body, selected.path, origin, backText = decoded.backText, encoding = 2)
        ensure(withinWorkingLimits(draftData(draft).fields)) { Failure.Invalid("writing.source-invalid", "Source exceeds working field limits.") }
        drafts.put(draft)
        associations.put(campaign, SourceAssociationData(card, selected.path, selected.declaredId, request.capture, selected.hash))
        draftData(draft)
    } }
}
