package workbench.sharing.application

import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.sharing.api.*
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.util.UUID

class DistributionService(private val campaigns: Campaigns, private val prepared: PreparedCards,
    private val players: SharingStore, private val cards: SharedCardStore, private val tx: Transactions, private val clock: SharingClock) {
    fun preview(campaign: UUID, request: PreviewSharedCard) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val source = prepared.card(campaign, request.session, request.item).bind()
        SharedCardPreview(fingerprint(source), source.visible, source.artwork != null)
    } }
    fun previewArtwork(campaign: UUID, request: DistributeCard) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val source = prepared.card(campaign, request.session, request.item).bind()
        ensure(fingerprint(source) == request.fingerprint) { changed() }
        ensureNotNull(source.artwork?.derivatives?.singleOrNull { it.variant == ImageVariant.DISPLAY }) { missing() }
    } }
    fun distribute(campaign: UUID, request: DistributeCard) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val previous = cards.operation(campaign, request.operation)
        if (previous != null) {
            ensure(previous.first == request) { Failure.Conflict("sharing.operation", "This operation was already used with different parameters.") }
            ensureNotNull(cards.retained(campaign, previous.second)?.card) { missing() }
        } else {
            request.recipient?.let { ensureNotNull(players.player(campaign, it)) { missing() } }
            val source = prepared.card(campaign, request.session, request.item).bind()
            ensure(fingerprint(source) == request.fingerprint) { changed() }
            cards.insert(campaign, request, source, clock.now())
        }
    } }
    fun collection(campaign: UUID, recipient: UUID?) = tx.run { either {
        campaigns.configuration(campaign).bind()
        recipient?.let { ensureNotNull(players.player(campaign, it)) { missing() } }
        SharedCollection(cards.cards(campaign, recipient))
    } }
    fun artwork(campaign: UUID, card: UUID) = tx.run { either {
        campaigns.configuration(campaign).bind()
        ensureNotNull(cards.artwork(campaign, card)) { missing() }
    } }
    private fun fingerprint(source: PreparedCard): String {
        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { out ->
            fun field(value: String) { val b=value.toByteArray(Charsets.UTF_8); out.writeInt(b.size); out.write(b) }
            val v=source.visible
            field("shared-card-1"); field(v.title); field(v.type); field(v.summary); out.writeInt(v.tags.size)
            v.tags.forEach(::field); field(v.backText)
            field(source.artwork?.metadata?.hash.orEmpty())
            source.artwork?.derivatives?.sortedBy { it.variant.name }?.forEach { field(it.variant.name); field(it.content.sha256) }
        }
        return MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()).joinToString("") { "%02x".format(it) }
    }
    private fun changed() = Failure.Conflict("sharing.preview-changed", "Prepared card changed. Review a fresh preview before sharing.")
    private fun missing() = Failure.NotFound("sharing.card", "Card, artwork or recipient is unavailable.")
}
