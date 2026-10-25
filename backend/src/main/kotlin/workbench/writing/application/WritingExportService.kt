package workbench.writing.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sources.api.*
import workbench.writing.api.*
import workbench.writing.domain.*
import java.time.Instant
import java.util.UUID

class WritingExportService(private val campaigns: Campaigns, private val store: DraftStore, private val exports: ExportStore, private val authoring: Authoring, private val sources: Sources, private val library: CardLibraryService, private val tx: Transactions) {
    private fun invalid(message: String) = Failure.Invalid("writing.export-invalid", message)
    private fun stale(message: String) = Failure.Conflict("writing.export-stale", message)
    private fun load(campaign: UUID, id: UUID): Either<Failure, Draft> = either {
        campaigns.configuration(campaign).bind()
        ensureNotNull(store.get(campaign, id)) { Failure.NotFound("writing.not-found", "Draft not found in this campaign.") }
    }
    fun fork(campaign: UUID, request: ForkDraft): Either<Failure, DraftData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val selected = sources.select(campaign, request.capture, request.path, null).bind()
        ensure(selected.markdown.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024) { invalid("Source exceeds the 2 MiB fork limit.") }
        val decoded = authoring.decode(selected.markdown)
        ensure(decoded.errors.isEmpty()) { invalid(decoded.errors.joinToString(" ")) }
        ensure(decoded.retainedEnvelope.toByteArray(Charsets.UTF_8).size <= 65_536) { invalid("Retained front matter exceeds 64 KiB.") }
        val type = decoded.type.takeIf { it in authoring.catalog().types } ?: request.type
        ensure(type in authoring.catalog().types) { invalid("Choose a content type explicitly for unclassified source material.") }
        ensure(store.list(campaign).size < 1000) { invalid("This campaign has reached the 1,000 draft limit.") }
        val id = UUID.randomUUID()
        val origin = DraftOrigin(campaign, request.capture, request.path, decoded.card, selected.markdown,
            selected.documentHash, decoded.retainedEnvelope, decoded.issues, 2)
        val parent = request.path.substringBeforeLast('/', "").let { if (it.isEmpty()) "" else "$it/" }
        val name = request.path.substringAfterLast('/').substringBeforeLast('.')
        val draft = Draft(id, campaign, UUID.randomUUID(), 0, if (decoded.legacy) selected.title else decoded.title, type!!, "draft", decoded.tags, decoded.summary, decoded.body, "$parent$name-draft-$id.md", origin, backText = decoded.backText, encoding = 2)
        ensure(withinWorkingLimits(draftData(draft).fields)) { invalid("Source fields exceed working draft limits; resolve them before copying.") }
        store.put(draft); draftData(draft)
    } }

    fun inspect(campaign: UUID, id: UUID, request: InspectExport): Either<Failure, ExportInspection> = tx.run { either {
        val draft = load(campaign, id).bind()
        ensure(draft.revision == request.revision) { stale("Draft changed. Save/reload and inspect this revision again.") }
        val resolved = library.resolveLinks(campaign, draft).bind()
        ensure(resolved.capture == request.capture) { stale("Library capture changed. Reload the source library and inspect again.") }
        report(draft, resolved)
    } }

    private fun report(draft: Draft, resolved: CardLibraryService.LinkResolution): ExportInspection {
        val encoded = authoring.encode(AuthoredDocument(draft.card, draft.title, draft.type, draft.status, draft.tags, draft.summary, draft.body, draft.backText, draft.encoding), draft.origin?.retainedEnvelope.orEmpty())
        val targets = store.list(draft.campaign)
        val links = resolved.links
        val errors = encoded.errors + exportPathErrors(draft.path) +
            (if (encoded.markdown.toByteArray(Charsets.UTF_8).size > 3 * 1024 * 1024) listOf("Encoded Markdown exceeds 3 MiB.") else emptyList()) +
            (if (exports.list(draft.campaign, draft.id).size >= 1000) listOf("This draft has reached the 1,000 artifact limit. Existing downloads remain available.") else emptyList())
        val warnings = mutableListOf<String>()
        if (resolved.capture == null) warnings += "No captured campaign library is available; source references cannot be verified."
        if (draft.path in resolved.sourcePaths) warnings += "Suggested placement already contains a source file. Export does not replace it."
        if (targets.any { it.id != draft.id && it.path == draft.path }) warnings += "Another draft shares the suggested placement."
        if (draft.origin != null && draft.origin.path.substringBeforeLast('/', "") != draft.path.substringBeforeLast('/', "") && links.any { it.kind !in setOf("local", "external") }) warnings += "Export directory differs from the original source directory. Relative links were checked against the new placement."
        warnings += encoded.preview.classification.issues.filter { it.severity != "error" }.map { it.message }
        warnings += links.mapNotNull { it.warning }
        val revisions = resolved.targetRevisions
        val hash = contentHash(encoded.markdown)
        val parts = listOf(draft.revision.toString(), resolved.capture?.toString().orEmpty(), draft.path, hash) +
            revisions.flatMap { listOf(it.key, it.value.toString()) } + errors + warnings + links.flatMap { listOf(it.key, it.destination, it.kind, it.path.orEmpty(), it.anchor.orEmpty(), it.section.orEmpty(), it.draft?.toString().orEmpty(), it.revision?.toString().orEmpty()) }
        val fingerprint = contentHash(parts.joinToString("") { "${it.length}:$it" })
        return ExportInspection(draft.revision, resolved.capture, draft.path, encoded.markdown, hash, fingerprint, errors, warnings.distinct(), links, revisions)
    }

    fun create(campaign: UUID, id: UUID, request: CreateExport): Either<Failure, ExportData> = tx.run { either {
        val draft = load(campaign, id).bind()
        val checked = inspect(campaign, id, InspectExport(request.revision, request.capture)).bind()
        ensure(request.fingerprint == checked.fingerprint) { stale("Export report or checked targets changed. Inspect and acknowledge the current report again.") }
        ensure(checked.errors.isEmpty()) { invalid(checked.errors.joinToString(" ")) }
        ensure(checked.warnings.isEmpty() || request.acknowledgeWarnings) { invalid("Acknowledge this report's warnings explicitly before preparing the download.") }
        val previous = exports.list(campaign, id)
        val same = previous.firstOrNull { it.fingerprint == checked.fingerprint && it.revision == draft.revision && it.acknowledged == request.acknowledgeWarnings }
        if (same != null) return@either data(exports.get(campaign, id, same.id)!!)
        ensure(previous.size < 1000) { invalid("This draft has reached the 1,000 artifact limit. Existing downloads remain available.") }
        val links = checked.links.map { FrozenExportLink(it.key, it.destination, it.kind, it.path, it.anchor, it.section, it.external, it.draft, it.revision, it.warning) }
        val artifact = ExportArtifact(UUID.randomUUID(), draft, Instant.now().toString(), checked.markdown, checked.hash, checked.capture, checked.fingerprint, checked.warnings, links, checked.targetRevisions, request.acknowledgeWarnings)
        exports.put(artifact); data(artifact)
    } }
    fun history(campaign: UUID, id: UUID): Either<Failure, ExportList> = tx.run { either {
        load(campaign, id).bind()
        ExportList(exports.list(campaign, id).map { ExportSummary(it.id, it.revision, it.createdAt, it.path, it.hash, it.warnings) })
    } }
    fun artifact(campaign: UUID, id: UUID, artifact: UUID): Either<Failure, ExportArtifact> = tx.run { either {
        load(campaign, id).bind()
        ensureNotNull(exports.get(campaign, id, artifact)) { Failure.NotFound("writing.export-not-found", "Export artifact not found in this campaign/draft.") }
    } }
    private fun data(a: ExportArtifact) = ExportData(a.id, a.snapshot.id, a.createdAt,
        ExportInspection(a.snapshot.revision, a.capture, a.snapshot.path, a.markdown, a.hash, a.fingerprint, emptyList(), a.warnings,
            a.links.map { CheckedLink(it.key, it.destination, it.kind, it.path, it.anchor, it.section, it.external, it.draft, it.revision, it.warning) }, a.targetRevisions), a.acknowledged)
}
