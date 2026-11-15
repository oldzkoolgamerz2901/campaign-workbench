package workbench.sharing.application

import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sharing.api.*
import java.util.UUID

class CardLifecycleService(private val campaigns: Campaigns, private val identity: PlayerAccess,
    private val players: SharingStore, private val cards: SharedCardStore, private val tx: Transactions,
    private val clock: SharingClock, private val piles: PileStore) : PlayerCardCommands {
    override fun claim(campaign: UUID, credential: String?, card: UUID) = tx.run { either {
        val player=identity.identify(campaign,credential).bind()
        val current=active(campaign,card)
        ensure(current.card.mode==SharingMode.INVENTORY && current.recipient==null) { conflict() }
        cards.transition(campaign,card,player.player,"ACTIVE","CLAIMED",clock.now())
    } }
    override fun remove(campaign: UUID, credential: String?, card: UUID) = tx.run { either {
        val player=identity.identify(campaign,credential).bind()
        val current=active(campaign,card)
        ensure(current.recipient==player.player && current.card.mode==SharingMode.INVENTORY) { conflict() }
        cards.transition(campaign,card,current.recipient,"DISCARDED","DISCARDED",clock.now())
    } }
    fun transfer(campaign: UUID, card: UUID, request: TransferSharedCard) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val current=active(campaign,card)
        ensure(current.card.mode==SharingMode.INVENTORY && current.recipient!=request.recipient) { conflict() }
        request.recipient?.let { ensureNotNull(players.player(campaign,it)) { conflict() } }
        ensure(request.recipient==null || request.pile==null) { conflict() }
        request.pile?.let { id -> ensure(piles.piles(campaign,null).any { it.id==id }) { conflict() } }
        cards.transition(campaign,card,request.recipient,"ACTIVE","TRANSFERRED",clock.now())
        request.pile?.let { piles.move(campaign,null,card,it,null) }
        ensureNotNull(cards.card(campaign,card)?.second) { conflict() }
    } }
    fun removeByDm(campaign: UUID, card: UUID) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val current=active(campaign,card)
        val state=if(current.card.mode==SharingMode.INVENTORY) "DISCARDED" else "WITHDRAWN"
        cards.transition(campaign,card,current.recipient,state,state,clock.now())
    } }
    fun restore(campaign: UUID, card: UUID) = tx.run { either {
        campaigns.configuration(campaign).bind()
        val current=ensureNotNull(cards.retained(campaign,card)) { conflict() }
        ensure(current.state!="ACTIVE") { conflict() }
        cards.transition(campaign,card,current.recipient,"ACTIVE","RESTORED",clock.now())
    } }
    fun removed(campaign: UUID) = tx.run { either {
        campaigns.configuration(campaign).bind()
        RemovedSharedCards(cards.removed(campaign))
    } }
    private fun Raise<Failure>.active(campaign: UUID, card: UUID): RemovedSharedCard {
        val current=ensureNotNull(cards.retained(campaign,card)) { conflict() }
        ensure(current.state=="ACTIVE") { conflict() }
        return current
    }
    private fun conflict()=Failure.Conflict("sharing.card-unavailable","This card is no longer available for that action. Refresh the collection.")
}
