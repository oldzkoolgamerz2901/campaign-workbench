package workbench.playthroughs.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.playthroughs.api.*
import java.time.Instant
import java.util.UUID

class PlayNoteService(private val campaigns: Campaigns, private val preparation: PreparedSessions,
    private val workspaces: Playthroughs, private val store: PlayNoteStore, private val tx: Transactions) : PlayNotes, PlayNoteTransfers {
    private fun invalid() = Failure.Invalid("playnotes.invalid", "Choose a prepared resource and nonempty Markdown within the note limits.")
    private fun conflict(code: String, detail: String) = Failure.Conflict("playnotes.$code", detail)
    private fun text(value: String) = value.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024
    private fun validMarkdown(value: String) = value.isNotBlank() && text(value)
    private fun PreparedItemData.context(): ResourceSnapshot {
        val classification = capturedSource?.classification
        val declared = classification?.takeIf { it.issues.none { issue -> issue.severity == "error" } }?.metadata?.id
        val card = provenance.authored?.card ?: declared
        return ResourceSnapshot(card?.let { ResourceReference(provenance.campaign, it) }, title)
    }
    private fun Raise<Failure>.resource(snapshot: SessionData, item: UUID?): ResourceSnapshot? = item?.let { id ->
        ensureNotNull(snapshot.items.find { it.id == id }) { invalid() }.context()
    }
    override fun list(campaign: UUID, session: UUID): Either<Failure, PlayNoteList> = snapshot(campaign, session).map(::PlayNoteList)
    override fun snapshot(campaign: UUID, session: UUID): Either<Failure, List<PlayNoteData>> = tx.run { either {
        campaigns.configuration(campaign).bind()
        preparation.snapshot(campaign, session).bind()
        store.list(session).map { it.note }.sortedWith(compareByDescending<PlayNoteData> { it.createdAt }.thenByDescending { it.id.toString() })
    } }
    override fun create(campaign: UUID, session: UUID, request: CreatePlayNote): Either<Failure, PlayNoteData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val snapshot = preparation.snapshot(campaign, session).bind()
        val retry = store.operation(session, request.operation)
        if (retry != null) {
            ensure(retry.creation == request) { conflict("operation-conflict", "This retry ID already belongs to different note text or context. Keep the draft and review before starting a new capture.") }
            // Return the current record, including subsequent edits; never recreate or overwrite it.
            retry.note
        } else {
            ensure(validMarkdown(request.markdown) && store.count(session) < 10000) { invalid() }
            val workspace = workspaces.open(campaign, session).bind()
            ensure(workspace.activeSceneItemId == request.expectedScene) { conflict("scene-context", "The active Scene changed. Your text is retained. Refresh and explicitly use the current Scene before saving.") }
            val now = Instant.now()
            val note = PlayNoteData(UUID.randomUUID(), campaign, session, 0, request.markdown,
                resource(snapshot, workspace.activeSceneItemId), resource(snapshot, request.resource), now, now, false)
            store.put(StoredPlayNote(note, request.operation, request))
            note
        }
    } }
    override fun edit(campaign: UUID, session: UUID, note: UUID, request: EditPlayNote): Either<Failure, PlayNoteData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val snapshot = preparation.snapshot(campaign, session).bind()
        val record = ensureNotNull(store.get(session, note)) { Failure.NotFound("playnotes.not-found", "This PlayNote is unavailable in this session.") }
        ensure(record.note.revision == request.revision) { conflict("stale-revision", "This note changed. Your edits are retained; reload the saved note before reviewing and saving again.") }
        ensure(validMarkdown(request.markdown) && request.revision < Long.MAX_VALUE) { invalid() }
        val next = record.note.copy(markdown = request.markdown, pinned = request.pinned,
            resource = if (request.changeResource) resource(snapshot, request.resource) else record.note.resource)
        val saved = if (next == record.note) next else next.copy(revision = next.revision + 1, updatedAt = Instant.now().coerceAtLeast(next.createdAt))
        store.put(record.copy(note = saved))
        saved
    } }
    override fun validate(notes: List<PlayNoteData>, campaign: UUID, session: UUID): Boolean =
        notes.size <= 10000 && notes.map { it.id }.distinct().size == notes.size && notes.all { n ->
            n.campaign == campaign && n.session == session && n.revision >= 0 && validMarkdown(n.markdown) && n.updatedAt >= n.createdAt &&
                listOfNotNull(n.scene, n.resource).all { text(it.title) && it.title.isNotBlank() }
        }
    override fun restore(campaign: UUID, session: UUID, notes: List<PlayNoteData>): Either<Failure, Unit> = tx.run { either {
        campaigns.configuration(campaign).bind()
        preparation.snapshot(campaign, session).bind()
        ensure(store.count(session) == 0L && validate(notes, campaign, session)) { invalid() }
        notes.forEach { store.put(StoredPlayNote(it.copy(id = UUID.randomUUID(), revision = 0))) }
    } }
}
