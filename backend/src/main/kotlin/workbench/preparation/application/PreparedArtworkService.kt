package workbench.preparation.application

import arrow.core.raise.*
import workbench.platform.api.*
import java.util.UUID

class PreparedArtworkService(private val preparation: PreparationService, private val images: PreparationImageStore, private val tx: Transactions) {
    fun read(campaign: UUID, session: UUID, item: UUID, variant: ImageVariant) = tx.run { either {
        val missing = Failure.NotFound("image.not-found", "Artwork is not available for this prepared item.")
        val s = preparation.open(campaign, session).bind()
        val m = ensureNotNull(s.items.singleOrNull { it.id == item }?.image) { missing }
        ensure(images.metadata(campaign, m.hash) == m) { missing }
        ensureNotNull(images.derivative(campaign, m.hash, ImageLimits.POLICY, variant)) { missing }
    } }
}
