package workbench.preparation.application

import arrow.core.raise.*
import workbench.preparation.api.*
import workbench.platform.api.*
import workbench.sources.api.CardLayoutInput
import java.util.UUID

class PreparedCardService(private val preparation: PreparationService, private val images: PreparationImageStore,
    private val tx: Transactions) : PreparedCards {
    override fun card(campaign: UUID, session: UUID, item: UUID) = tx.run { either {
        val current = ensureNotNull(preparation.open(campaign, session).bind().items.singleOrNull { it.id == item }) {
            Failure.NotFound("sharing.source", "Prepared card is unavailable.")
        }
        val metadata = current.capturedSource?.classification?.metadata
        val artwork = current.image?.let { image ->
            ensureNotNull(images.bundle(campaign, image.hash)?.takeIf { it.metadata == image }) {
                Failure.NotFound("sharing.source-artwork", "Prepared artwork is unavailable.")
            }
        }
        val provenance = current.provenance
        val authored = provenance.authored
        PreparedCard(CardLayoutInput(metadata?.title?.takeIf { it.isNotEmpty() } ?: current.title, metadata?.type?.takeIf { it.isNotEmpty() } ?: "card",
            metadata?.summary.orEmpty(), metadata?.tags.orEmpty(), metadata?.backText.orEmpty()), artwork,
            PreparedCardProvenance(campaign,session,item,provenance.capture,provenance.path,provenance.section,
                provenance.documentHash,provenance.contentHash,provenance.kind,authored?.draft,authored?.card,authored?.revision,authored?.approval))
    } }
}
