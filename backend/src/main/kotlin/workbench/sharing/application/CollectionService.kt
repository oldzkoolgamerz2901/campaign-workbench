package workbench.sharing.application

import arrow.core.raise.*
import workbench.platform.api.*
import workbench.sharing.api.*
import workbench.sources.api.CardLayoutCalculator
import java.util.UUID

class CollectionService(private val identity: PlayerAccess, private val cards: SharedCardStore,
    private val tx: Transactions, private val layouts: CardLayoutCalculator, private val piles: PileStore) : PlayerCards {
    override fun collections(campaign: UUID, credential: String?) = tx.run { either {
        val player=identity.identify(campaign, credential).bind()
        PlayerCollections(player, SharedCollection(cards.cards(campaign, null),piles.piles(campaign,null)), SharedCollection(cards.cards(campaign, player.player),piles.piles(campaign,player.player)))
    } }
    override fun artwork(campaign: UUID, credential: String?, card: UUID) = tx.run { either {
        val player=identity.identify(campaign, credential).bind()
        accessible(campaign, player.player, card)
        ensureNotNull(cards.artwork(campaign, card)) { missing() }
    } }
    override fun layout(campaign: UUID, credential: String?, card: UUID) = tx.run { either {
        val player=identity.identify(campaign, credential).bind()
        layouts.layout(accessible(campaign, player.player, card).visible)
    } }
    private fun Raise<Failure>.accessible(campaign: UUID, player: UUID, card: UUID): SharedCardData {
        val entry=ensureNotNull(cards.card(campaign, card)) { missing() }
        ensure(entry.first == null || entry.first == player) { missing() }
        return entry.second
    }
    private fun missing() = Failure.NotFound("sharing.card", "Card or artwork is unavailable.")
}
