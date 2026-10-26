package workbench.preparation.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.sources.api.SourceFilter
import workbench.writing.api.*
import java.util.UUID

/** Preparation owns destination membership; Writing owns catalogue identity and approval. */
class SessionLibraryService(private val campaigns: Campaigns, private val library: CardLibraries,
    private val preparation: PreparationService, private val tx: Transactions) {
    private fun invalid(message: String) = Failure.Invalid("preparation.library-invalid", message)
    private fun matches(campaign: UUID, session: SessionData, entry: LibraryEntry) = session.items.filter {
        entry.card != null && it.provenance.campaign == campaign && it.provenance.section == null &&
            (it.provenance.authored?.card ?: it.capturedSource?.classification?.metadata?.id) == entry.card
    }
    private fun newer(item: PreparedItemData, entry: LibraryEntry) = entry.draft != null &&
        (item.provenance.authored?.draft != entry.draft || item.provenance.authored?.revision != entry.revision)
    private fun sameType(item: PreparedItemData, entry: LibraryEntry) = item.capturedSource?.classification?.metadata?.let {
        it.type == entry.classification.metadata?.type
    } == true

    fun list(campaign: UUID, id: UUID, query: String = "", filter: SourceFilter = SourceFilter()): Either<Failure, SessionLibrary> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val session = preparation.open(campaign, id).bind()
        val catalogue = library.list(campaign, query, filter).bind()
        SessionLibrary(id, session.revision, catalogue.capture, catalogue.entries.map { entry ->
            val found = matches(campaign, session, entry).map { item ->
                PreparedCardMatch(item.id, newer(item, entry), newer(item, entry) && entry.ready && sameType(item, entry))
            }
            SessionLibraryEntry(entry, when {
                found.isNotEmpty() && found.none { it.updateAvailable } -> SessionCardState.ALREADY_PREPARED
                !entry.ready -> SessionCardState.BLOCKED
                found.any { it.updateAvailable } -> SessionCardState.UPDATE_AVAILABLE
                found.isNotEmpty() -> SessionCardState.ALREADY_PREPARED
                else -> SessionCardState.READY
            }, found)
        })
    } }

    private fun selected(campaign: UUID, request: AddLibraryCard): Either<Failure, LibraryEntry> = either {
        ensure(request.revision >= 0 && request.key.length <= 8192 && (request.draftRevision == null || request.draftRevision >= 0)) { invalid("Invalid destination or catalogue revision.") }
        val catalogue = library.list(campaign).bind()
        ensure(catalogue.capture == request.capture) { Failure.Conflict("sources.capture-replaced", "Captured library changed. Reload before preparing this card.") }
        val entry = ensureNotNull(catalogue.entries.find { it.key == request.key }) { Failure.NotFound("writing.library-not-found", "Library card is unavailable.") }
        ensure(entry.conflicts.isEmpty()) { Failure.Conflict("writing.identity-conflict", "Resolve conflicting Source/card identities before preparing this card.") }
        entry
    }
    private fun exact(entry: LibraryEntry, request: AddLibraryCard): Either<Failure, Unit> = either {
        ensure(entry.draft == request.draft && entry.revision == request.draftRevision) {
            Failure.Conflict("writing.stale-revision", "Draft identity or saved revision changed. Reload the catalogue before preparing this card.")
        }
        ensure(entry.ready) { invalid(if (entry.fitIssues.isNotEmpty()) "Card text does not fit. Shorten the front title, summary or tags, or the back text in Write." else "Complete valid session metadata in Write before preparing this card.") }
    }
    private fun revision(session: SessionData, expected: Long): Either<Failure, Unit> = either {
        ensure(session.revision == expected) { Failure.Conflict("preparation.stale-revision", "Session changed. Reload explicitly before changing membership or replacing content.") }
    }

    fun add(campaign: UUID, id: UUID, request: AddLibraryCard): Either<Failure, LibraryAddResult> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val session = preparation.open(campaign, id).bind()
        val entry = selected(campaign, request).bind()
        val existing = matches(campaign, session, entry)
        // A retry cannot update content. A stale destination revision/Source→Draft selection
        // may safely return existing membership, including every historical whole-card match.
        if (existing.isNotEmpty()) return@either LibraryAddResult(session, false, existing.map { it.id })
        revision(session, request.revision).bind()
        exact(entry, request).bind()
        val draft = entry.draft ?: run {
            val source = ensureNotNull(entry.sources.singleOrNull()?.takeIf { it.capture != null }) { invalid("Choose an available, unambiguous Source.") }
            library.editSource(campaign, EditLibrarySource(request.capture!!, source.path)).bind().id
        }
        val after = preparation.addDraft(campaign, id, AddDraft(session.revision, draft, entry.revision ?: 0)).bind()
        LibraryAddResult(after, true, listOf(after.items.last().id))
    } }

    fun replace(campaign: UUID, id: UUID, item: UUID, request: AddLibraryCard): Either<Failure, SessionData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val session = preparation.open(campaign, id).bind()
        revision(session, request.revision).bind()
        val entry = selected(campaign, request).bind()
        val before = ensureNotNull(matches(campaign, session, entry).find { it.id == item }) { invalid("Choose a whole prepared card with the same origin identity.") }
        ensure(sameType(before, entry)) { invalid("Card type changed. In-place replacement requires the same valid card type.") }
        val draft = ensureNotNull(entry.draft) { invalid("Save an editable Draft in Write before replacing this prepared version.") }
        // No approval churn or session revision change when already at this exact saved version.
        if (!newer(before, entry)) {
            ensure(entry.draft == request.draft && entry.revision == request.draftRevision) {
                Failure.Conflict("writing.stale-revision", "Draft identity or saved revision changed. Reload the catalogue before preparing this card.")
            }
            return@either session
        }
        exact(entry, request).bind()
        preparation.replaceDraft(campaign, id, item, AddDraft(request.revision, draft, request.draftRevision!!)).bind()
    } }
}
