package workbench.writing.api

import arrow.core.Either
import workbench.platform.api.Failure
import workbench.sources.api.AuthoredPreview
import workbench.sources.api.CheckedLink
import java.util.UUID

/** Called inside Preparation's transaction; never approves a different working revision. */
interface SessionDrafts {
    fun retain(campaign: UUID, draft: UUID, revision: Long): Either<Failure, ApprovedDraft>
}
data class ApprovedDraft(val snapshot: DraftData, val markdown: String, val hash: String, val preview: AuthoredPreview,
    val capture: UUID?, val links: List<CheckedLink>)
