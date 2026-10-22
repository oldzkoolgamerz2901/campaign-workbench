package workbench.writing.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.sources.api.*
import workbench.platform.api.*
import workbench.writing.api.*
import workbench.writing.domain.Draft
import java.util.UUID

class WritingService(private val campaigns: Campaigns, private val store: DraftStore, private val authoring: Authoring, private val tx: Transactions, private val sources: Sources, private val images: WritingImageStore, private val processor: ImageProcessor) {
    private fun invalid(message: String) = Failure.Invalid("writing.invalid", message)
    private fun data(d: Draft) = draftData(d)
    private fun load(campaign: UUID, id: UUID): Either<Failure, Draft> = either { ensureNotNull(store.get(campaign, id)) { Failure.NotFound("writing.not-found", "Draft not found in this campaign.") } }
    fun list(campaign: UUID): Either<Failure, DraftList> = tx.run { either {
        campaigns.configuration(campaign).bind()
        DraftList(store.list(campaign).map(::data), authoring.catalog())
    } }
    fun open(campaign: UUID, id: UUID): Either<Failure, DraftData> = tx.run { either { campaigns.configuration(campaign).bind(); data(load(campaign, id).bind()) } }
    fun create(campaign: UUID, request: CreateDraft): Either<Failure, DraftData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        ensure(request.type in authoring.catalog().types) { invalid("Choose a supported content type.") }
        ensure(store.list(campaign).size < 1000) { invalid("This campaign has reached the 1,000 draft limit.") }
        val id = UUID.randomUUID()
        val draft = Draft(id, campaign, UUID.randomUUID(), 0, "", request.type, "draft", emptyList(), "", if (request.template) authoring.catalog().templates.getValue(request.type) else "", "${request.type}s/$id.md")
        store.put(draft); data(draft)
    } }
    fun save(campaign: UUID, id: UUID, request: SaveDraft): Either<Failure, DraftData> = commit(campaign, id, request, null)
    fun replaceImage(campaign: UUID, id: UUID, request: SaveDraft, input: java.io.InputStream): Either<Failure, DraftData> = either {
        ensure(request.imageAction == "replace") { invalid("Replacement requires imageAction=replace.") }
        val image = processor.process(input).bind()
        commit(campaign, id, request, image).bind()
    }
    private fun commit(campaign: UUID, id: UUID, request: SaveDraft, replacement: ProcessedImage?): Either<Failure, DraftData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val before = load(campaign, id).bind()
        ensure(request.revision == before.revision) { Failure.Conflict("writing.stale-revision", "This draft changed elsewhere. Your edits are retained; reload explicitly before editing the newer revision.") }
        ensure(request.imageAction in setOf("keep", "remove", "replace") && (request.imageAction == "replace") == (replacement != null)) { invalid("Invalid image change command.") }
        val f = request.fields
        ensure(withinWorkingLimits(f)) { invalid("Keep each text field within 2 MiB, up to 128 working tags of 4 KiB each, and type/status within 64 characters. Your working edits are retained.") }
        val owner = WritingImageOwner.Campaign(campaign)
        replacement?.let { images.put(owner, it) }
        val artwork = when (request.imageAction) { "replace" -> replacement!!.metadata; "remove" -> null; else -> before.image }
        // Incomplete metadata is durable working content; interpretation reports readiness separately.
        val after = before.copy(revision = before.revision + 1, title = f.title, type = f.type, status = f.status, tags = f.tags, summary = f.summary, body = f.body, path = f.path, image = artwork)
        store.put(after); images.prune(owner); data(after)
    } }
    fun delete(campaign: UUID, id: UUID, revision: Long): Either<Failure, Unit> = tx.run { either {
        ensure(revision >= 0) { invalid("A nonnegative saved revision is required for deletion.") }
        campaigns.configuration(campaign).bind()
        val before = load(campaign, id).bind()
        ensure(before.revision == revision) { Failure.Conflict("writing.stale-revision", "This draft changed elsewhere. Your edits are retained; reload explicitly before deleting the newer revision.") }
        store.delete(campaign, id); images.prune(WritingImageOwner.Campaign(campaign))
    } }
    fun preview(campaign: UUID, id: UUID, fields: DraftFields): Either<Failure, DraftPreview> = either {
        tx.run { either { campaigns.configuration(campaign).bind(); load(campaign, id).bind() } }.bind().let { draft ->
            ensure(withinWorkingLimits(fields)) { invalid("Preview exceeds working draft limits.") }
            val library = sources.authoringLibrary(campaign).bind()
            val targets = store.list(campaign).map { AuthoredTarget(it.id, it.revision, if (it.id == draft.id) fields.path else it.path, if (it.id == draft.id) fields.body else it.body) }
            DraftPreview(authoring.encode(AuthoredDocument(draft.card, fields.title, fields.type, fields.status, fields.tags, fields.summary, fields.body), draft.origin?.retainedEnvelope.orEmpty()).preview,
                exportPathErrors(fields.path), authoring.links(fields.path, fields.body, library.documents, targets, draft.id), library.capture)
        }
    }
}
