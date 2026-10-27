package workbench.sharing.application

import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sharing.api.*
import java.util.UUID

class OrganizationService(private val campaigns: Campaigns, private val identity: PlayerAccess,
    private val cards: SharedCardStore, private val piles: PileStore, private val tx: Transactions) : PlayerOrganization {
    override fun organize(campaign: UUID, credential: String?, request: OrganizeCollection) = tx.run { either {
        val player=identity.identify(campaign,credential).bind()
        apply(campaign,player.player,request)
    } }
    fun organizeGroup(campaign: UUID, request: OrganizeCollection) = tx.run { either {
        campaigns.configuration(campaign).bind()
        apply(campaign,null,request)
    } }
    private fun Raise<Failure>.apply(campaign: UUID, recipient: UUID?, r: OrganizeCollection): SharedCollection {
        val all=cards.cards(campaign,recipient)
        val ps=piles.piles(campaign,recipient)
        fun pile(id: UUID?) = ensureNotNull(ps.find { it.id==id }) { conflict() }
        fun name(): String {
            val n=r.name.orEmpty().trim()
            ensure(n.isNotEmpty() && n.length<=200) { Failure.Invalid("sharing.pile-name","Enter a pile name of 1–200 characters.") }
            return n
        }
        when(r.kind) {
            "CREATE" -> piles.create(campaign,recipient,name())
            "RENAME" -> piles.rename(campaign,pile(r.pile).id,name())
            "DELETE" -> {
                val p=pile(r.pile)
                val members=all.filter { it.pile==p.id }
                ensure(members.isEmpty() || r.confirmed) { Failure.Conflict("sharing.pile-confirmation","Pile contains cards. Confirm deletion after reviewing it.") }
                members.forEach { piles.move(campaign,recipient,it.id,null,null) }
                piles.delete(campaign,p.id)
            }
            "ORDER" -> {
                val p=pile(r.pile)
                ensure(r.before!=p.id) { conflict() }
                r.before?.let { pile(it) }
                val ids=ps.map { it.id }.filter { it!=p.id }.toMutableList()
                ids.add(if(r.before==null) ids.size else ids.indexOf(r.before),p.id)
                piles.order(campaign,ids)
            }
            "COVER" -> {
                val p=pile(r.pile)
                ensure(all.any { it.id==r.card && it.pile==p.id }) { conflict() }
                piles.cover(campaign,p.id,r.card)
            }
            "MOVE" -> {
                val card=ensureNotNull(all.find { it.id==r.card }) { conflict() }
                ensure(card.pile==r.source && r.before!=card.id) { conflict() }
                r.pile?.let { pile(it) }
                r.before?.let { id -> ensure(all.any { it.id==id && it.pile==r.pile }) { conflict() } }
                // Reordering within the same location must preserve cover identity.
                val previous=ps.find { it.id==card.pile }?.cover
                piles.move(campaign,recipient,card.id,r.pile,r.before)
                if(card.pile==r.pile && r.pile!=null) piles.cover(campaign,r.pile,previous)
            }
            else -> raise(Failure.Invalid("sharing.organization-command","Unknown organization command."))
        }
        return SharedCollection(cards.cards(campaign,recipient),piles.piles(campaign,recipient))
    }
    private fun conflict()=Failure.Conflict("sharing.organization-stale","Organization changed. Refresh and try again.")
}
