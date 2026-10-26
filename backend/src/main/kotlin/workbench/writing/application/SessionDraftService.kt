package workbench.writing.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sources.api.*
import workbench.writing.api.*
import java.util.UUID

interface ApprovedRevisionStore {
    fun get(campaign: UUID, draft: UUID, revision: Long): ApprovedDraft?
    fun put(value: ApprovedDraft)
}
class SessionDraftService(private val campaigns: Campaigns, private val drafts: DraftStore,
    private val revisions: ApprovedRevisionStore, private val authoring: Authoring, private val library: CardLibraryService,
    private val tx: Transactions, private val images: WritingImageStore, private val layouts: CardLayoutCalculator) : SessionDrafts {
    override fun image(campaign: UUID, draft: UUID, revision: Long): Either<Failure, ProcessedImage?> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val approved = ensureNotNull(revisions.get(campaign, draft, revision)) { Failure.NotFound("writing.approval-not-found", "Approved revision not found.") }
        val m = approved.snapshot.image ?: return@either null
        ensureNotNull(images.bundle(WritingImageOwner.Campaign(campaign), m.hash)) { Failure.Unreadable("image.unavailable", "Retained artwork is unavailable.") }.also {
            ensure(it.metadata == m) { Failure.Unreadable("image.unavailable", "Retained artwork differs from its approved descriptor.") }
        }
    } }
    override fun retain(campaign: UUID, draft: UUID, revision: Long): Either<Failure, ApprovedDraft> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val d = ensureNotNull(drafts.get(campaign, draft)) { Failure.NotFound("writing.not-found", "Draft not found in this campaign.") }
        ensure(d.revision == revision) { Failure.Conflict("writing.stale-revision", "Draft changed. Review its saved revision before approving it.") }
        val encoded = authoring.encode(AuthoredDocument(d.card, d.title, d.type, d.status, d.tags, d.summary, d.body, d.backText, d.encoding), d.origin?.retainedEnvelope.orEmpty())
        ensure(encoded.errors.isEmpty() && encoded.preview.classification.metadata?.purpose == "session" &&
            encoded.preview.classification.issues.none { it.severity == "error" } && exportPathErrors(d.path).isEmpty() &&
            encoded.markdown.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024) {
            Failure.Invalid("writing.not-ready", "A valid session card, campaign-relative path and Markdown within 2 MiB are required for approval.")
        }
        val fit = layouts.layout(encoded.preview.classification.metadata?.layoutInput() ?: CardLayoutInput(d.title, d.type, d.summary, d.tags, d.backText))
        ensure(fit.front.fits && fit.back.fits) { Failure.Invalid("writing.card-does-not-fit", "Card text does not fit. Shorten the front title, summary or tags, or the back text in Write before adding it to a session.") }
        revisions.get(campaign, draft, revision)?.let { return@either it }
        val resolved = library.resolveLinks(campaign, d).bind()
        ApprovedDraft(draftData(d), encoded.markdown, contentHash(encoded.markdown), encoded.preview, resolved.capture, resolved.links).also(revisions::put)
    } }
}
