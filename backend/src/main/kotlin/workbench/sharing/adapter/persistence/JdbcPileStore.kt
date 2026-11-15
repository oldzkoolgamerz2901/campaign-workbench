package workbench.sharing.adapter.persistence

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import workbench.sharing.api.SharedPile
import workbench.sharing.application.PileStore
import java.util.UUID

@Repository
class JdbcPileStore(private val jdbc: JdbcTemplate) : PileStore {
    override fun piles(campaign: UUID, recipient: UUID?) = jdbc.query(
        "SELECT * FROM sharing.pile WHERE campaign=? AND recipient IS NOT DISTINCT FROM ?::uuid ORDER BY position,id",
        { r, _ -> SharedPile(r.getObject("id",UUID::class.java),r.getString("name"),r.getObject("cover",UUID::class.java)) },campaign,recipient)
    override fun create(campaign: UUID, recipient: UUID?, name: String): UUID {
        val id=UUID.randomUUID()
        jdbc.update("INSERT INTO sharing.pile(campaign,id,recipient,name,position) SELECT ?,?,?,?,COALESCE(max(position),0)+1 FROM sharing.pile WHERE campaign=? AND recipient IS NOT DISTINCT FROM ?::uuid",campaign,id,recipient,name,campaign,recipient)
        return id
    }
    override fun rename(campaign: UUID, pile: UUID, name: String) { jdbc.update("UPDATE sharing.pile SET name=? WHERE campaign=? AND id=?",name,campaign,pile) }
    override fun order(campaign: UUID, ids: List<UUID>) { ids.forEachIndexed { i,id -> jdbc.update("UPDATE sharing.pile SET position=? WHERE campaign=? AND id=?",i.toLong(),campaign,id) } }
    override fun cover(campaign: UUID, pile: UUID, card: UUID?) { jdbc.update("UPDATE sharing.pile SET cover=? WHERE campaign=? AND id=?",card,campaign,pile) }
    override fun move(campaign: UUID, recipient: UUID?, card: UUID, pile: UUID?, before: UUID?) {
        repairDeparture(jdbc,campaign,card)
        val ids=jdbc.query("SELECT id FROM sharing.shared_card WHERE campaign=? AND recipient IS NOT DISTINCT FROM ?::uuid AND pile IS NOT DISTINCT FROM ?::uuid AND state='ACTIVE' AND id<>? ORDER BY position,id",{r,_->r.getObject("id",UUID::class.java)},campaign,recipient,pile,card).toMutableList()
        ids.add(if(before==null) ids.size else ids.indexOf(before),card)
        jdbc.update("UPDATE sharing.shared_card SET pile=? WHERE campaign=? AND id=?",pile,campaign,card)
        ids.forEachIndexed { i,id -> jdbc.update("UPDATE sharing.shared_card SET position=? WHERE campaign=? AND id=?",i.toLong(),campaign,id) }
        if(pile!=null) jdbc.update("UPDATE sharing.pile SET cover=COALESCE(cover,?) WHERE campaign=? AND id=?",card,campaign,pile)
    }
    override fun delete(campaign: UUID, pile: UUID) { jdbc.update("DELETE FROM sharing.pile WHERE campaign=? AND id=?",campaign,pile) }
}

/** Run before a departure while the old membership and order are still available. */
internal fun repairDeparture(jdbc: JdbcTemplate, campaign: UUID, card: UUID) {
    jdbc.update("""UPDATE sharing.pile p SET cover=(SELECT c.id FROM sharing.shared_card c
        JOIN sharing.shared_card old ON old.campaign=c.campaign AND old.id=?
        WHERE c.campaign=p.campaign AND c.pile=p.id AND c.state='ACTIVE' AND c.id<>old.id
        ORDER BY CASE WHEN (c.position,c.id)>(old.position,old.id) THEN 0 ELSE 1 END,c.position,c.id LIMIT 1)
        WHERE p.campaign=? AND p.cover=?""",card,campaign,card)
}
