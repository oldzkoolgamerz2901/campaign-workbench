package workbench.writing.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import java.util.UUID

class ArtworkService(private val campaigns: Campaigns, private val drafts: DraftStore,
    private val revisions: ApprovedRevisionStore, private val exports: ExportStore,
    private val recovery: RecoveryService, private val images: WritingImageStore, private val tx: Transactions) {
    private fun missing() = Failure.NotFound("image.not-found", "Artwork is not available for this record.")
    private fun load(owner: WritingImageOwner, metadata: ImageMetadata?, variant: ImageVariant): Either<Failure, ImageDerivative> = either {
        val m = ensureNotNull(metadata) { missing() }
        ensure(images.metadata(owner, m.hash) == m) { missing() }
        ensureNotNull(images.derivative(owner, m.hash, ImageLimits.POLICY, variant)) { missing() }
    }
    fun draft(campaign: UUID, draft: UUID, variant: ImageVariant) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val d = ensureNotNull(drafts.get(campaign, draft)) { missing() }
        load(WritingImageOwner.Campaign(campaign), d.image, variant).bind()
    } }
    fun approved(campaign: UUID, draft: UUID, revision: Long, variant: ImageVariant) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val a = ensureNotNull(revisions.get(campaign, draft, revision)) { missing() }
        load(WritingImageOwner.Campaign(campaign), a.snapshot.image, variant).bind()
    } }
    fun exported(campaign: UUID, draft: UUID, artifact: UUID, variant: ImageVariant) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val a = ensureNotNull(exports.get(campaign, draft, artifact)) { missing() }
        load(WritingImageOwner.Campaign(campaign), a.snapshot.image, variant).bind()
    } }
    fun recovered(workspace: UUID, key: String, variant: ImageVariant) = either {
        val d = recovery.detail(workspace, key).bind()
        load(WritingImageOwner.Recovery(workspace), d.snapshot.image, variant).bind()
    }
}
