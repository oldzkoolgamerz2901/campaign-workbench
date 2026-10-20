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
    private val revisions: ApprovedRevisionStore, private val authoring: Authoring, private val sources: Sources,
    private val tx: Transactions) : SessionDrafts {
    override fun retain(campaign: UUID, draft: UUID, revision: Long): Either<Failure, ApprovedDraft> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val d = ensureNotNull(drafts.get(campaign, draft)) { Failure.NotFound("writing.not-found", "Draft not found in this campaign.") }
        ensure(d.revision == revision) { Failure.Conflict("writing.stale-revision", "Draft changed. Review its saved revision before approving it.") }
        revisions.get(campaign, draft, revision)?.let { return@either it }
        val encoded = authoring.encode(AuthoredDocument(d.card, d.title, d.type, d.status, d.tags, d.summary, d.body), d.origin?.retainedEnvelope.orEmpty())
        ensure(encoded.errors.isEmpty() && encoded.preview.classification.metadata?.purpose == "session" &&
            encoded.preview.classification.issues.none { it.severity == "error" } && exportPathErrors(d.path).isEmpty() &&
            encoded.markdown.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024) {
            Failure.Invalid("writing.not-ready", "A valid session card, campaign-relative path and Markdown within 2 MiB are required for approval.")
        }
        val library = sources.authoringLibrary(campaign).bind()
        val links = authoring.links(d.path, d.body, library.documents,
            drafts.list(campaign).map { AuthoredTarget(it.id, it.revision, it.path, it.body) }, d.id)
        ApprovedDraft(draftData(d), encoded.markdown, contentHash(encoded.markdown), encoded.preview, library.capture, links).also(revisions::put)
    } }
}
