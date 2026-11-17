package workbench.sharing.application

import workbench.platform.api.ProcessedImage
import workbench.preparation.api.PreparedCard
import workbench.preparation.api.PreparedCardContent
import workbench.preparation.api.PreparedCardProvenance
import workbench.sharing.api.SharedCardContent
import workbench.sources.api.CardLayoutInput

/** Sharing's immutable distribution snapshot, assembled before persistence. */
data class FrozenSharedCard(val visible: SharedCardContent, val artwork: ProcessedImage?, val provenance: PreparedCardProvenance, val detailsImage: ProcessedImage? = null)

internal fun PreparedCardContent.sharedContent() = SharedCardContent(title, type, summary, tags, backText, quote, stats?.sharedStats())
internal fun PreparedCard.freezeForSharing() = FrozenSharedCard(visible.sharedContent(), artwork, provenance, detailsImage)
internal fun SharedCardContent.layoutInput() = CardLayoutInput(title, type, summary, tags, backText, quote, stats?.layoutStats())
