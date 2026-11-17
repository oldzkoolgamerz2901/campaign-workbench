package workbench.sharing.adapter.persistence

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.platform.api.*
import workbench.sharing.application.FrozenSharedCard
import workbench.sharing.api.*
import workbench.sharing.application.SharedCardStore
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

@Repository
class JdbcSharedCardStore(private val jdbc: JdbcTemplate, private val mapper: ObjectMapper) : SharedCardStore {
    private val select = """SELECT s.*,c.visible,EXISTS(SELECT 1 FROM sharing.card_artwork a WHERE a.campaign=s.campaign AND a.content=s.content AND a.role='FRONT') AS artwork,EXISTS(SELECT 1 FROM sharing.card_artwork a WHERE a.campaign=s.campaign AND a.content=s.content AND a.role='DETAILS') AS details_image
        FROM sharing.shared_card s JOIN sharing.card_content c ON c.campaign=s.campaign AND c.id=s.content"""
    private fun ResultSet.data() = SharedCardData(getObject("id", UUID::class.java),
        mapper.readValue(getString("visible"), SharedCardContent::class.java), SharingMode.valueOf(getString("mode")), getBoolean("artwork"), getObject("pile",UUID::class.java), getBoolean("back_revealed"), getBoolean("details_image"))
    override fun retained(campaign: UUID, card: UUID) = jdbc.query("$select WHERE s.campaign=? AND s.id=?",
        {r,_->RemovedSharedCard(r.data(),r.getObject("recipient",UUID::class.java),r.getString("state"))},campaign,card).singleOrNull()
    override fun removed(campaign: UUID) = jdbc.query("$select WHERE s.campaign=? AND s.state<>'ACTIVE' ORDER BY s.id",
        {r,_->RemovedSharedCard(r.data(),r.getObject("recipient",UUID::class.java),r.getString("state"))},campaign)
    override fun transition(campaign: UUID, card: UUID, recipient: UUID?, state: String, kind: String, now: Instant): SharedCardData {
        repairDeparture(jdbc,campaign,card)
        val position=jdbc.queryForObject("SELECT COALESCE(max(position),0)+1 FROM sharing.shared_card WHERE campaign=? AND recipient IS NOT DISTINCT FROM ?::uuid AND state='ACTIVE' AND pile IS NULL",Long::class.java,campaign,recipient)!!
        jdbc.update("UPDATE sharing.shared_card SET recipient=?,state=?,position=?,pile=NULL WHERE campaign=? AND id=?",recipient,state,position,campaign,card)
        jdbc.update("INSERT INTO sharing.card_event(campaign,card,kind,recipient,occurred_at) VALUES (?,?,?,?,?)",campaign,card,kind,recipient,Timestamp.from(now))
        return retained(campaign,card)!!.card
    }
    override fun reveal(campaign: UUID, card: UUID, now: Instant): SharedCardData {
        val changed = jdbc.update("UPDATE sharing.shared_card SET back_revealed=true WHERE campaign=? AND id=? AND state='ACTIVE' AND NOT back_revealed", campaign, card)
        if (changed == 1) jdbc.update("INSERT INTO sharing.card_event(campaign,card,kind,recipient,occurred_at) SELECT campaign,id,'BACK_REVEALED',recipient,? FROM sharing.shared_card WHERE campaign=? AND id=?", Timestamp.from(now), campaign, card)
        return retained(campaign, card)!!.card
    }
    override fun operation(campaign: UUID, operation: UUID) = jdbc.query(
        "SELECT parameters,card FROM sharing.distribution WHERE campaign=? AND operation=?",
        { r, _ -> mapper.readValue(r.getString("parameters"), DistributeCard::class.java) to r.getObject("card", UUID::class.java) }, campaign, operation).singleOrNull()
    override fun insert(campaign: UUID, request: DistributeCard, source: FrozenSharedCard, now: Instant): SharedCardData {
        val id=UUID.randomUUID()
        jdbc.update("INSERT INTO sharing.card_content(campaign,id,visible,provenance) VALUES (?,?,?::jsonb,?::jsonb)",
            campaign,id,mapper.writeValueAsString(source.visible),mapper.writeValueAsString(source.provenance))
        listOf("FRONT" to source.artwork, "DETAILS" to source.detailsImage).forEach { (role, artwork) ->
            artwork?.derivatives?.forEach { image ->
                jdbc.update("INSERT INTO sharing.card_artwork(campaign,content,variant,mime,width,height,bytes,role) VALUES (?,?,?,?,?,?,?,?)",
                    campaign,id,image.variant.name,image.mime,image.width,image.height,image.content.copy(),role)
            }
        }
        val position=jdbc.queryForObject("SELECT COALESCE(max(position),0)+1 FROM sharing.shared_card WHERE campaign=? AND recipient IS NOT DISTINCT FROM ?::uuid AND state='ACTIVE'",Long::class.java,campaign,request.recipient)!!
        jdbc.update("INSERT INTO sharing.shared_card(campaign,id,content,recipient,mode,position,back_revealed) VALUES (?,?,?,?,?,?,?)",campaign,id,id,request.recipient,request.mode.name,position,request.revealBack)
        jdbc.update("INSERT INTO sharing.distribution(campaign,operation,parameters,card) VALUES (?,?,?::jsonb,?)",campaign,request.operation,mapper.writeValueAsString(request),id)
        jdbc.update("INSERT INTO sharing.card_event(campaign,card,kind,recipient,occurred_at) VALUES (?,?,'DISTRIBUTED',?,?)",campaign,id,request.recipient,Timestamp.from(now))
        return SharedCardData(id,source.visible,request.mode,source.artwork!=null,backRevealed=request.revealBack,detailsImage=source.detailsImage!=null)
    }
    override fun cards(campaign: UUID, recipient: UUID?) = jdbc.query("$select WHERE s.campaign=? AND s.recipient IS NOT DISTINCT FROM ?::uuid AND s.state='ACTIVE' ORDER BY s.position,s.id",{r,_->r.data()},campaign,recipient)
    override fun card(campaign: UUID, card: UUID) = jdbc.query("$select WHERE s.campaign=? AND s.id=? AND s.state='ACTIVE'",{r,_->r.getObject("recipient",UUID::class.java) to r.data()},campaign,card).singleOrNull()
    override fun artwork(campaign: UUID, card: UUID, details: Boolean) = jdbc.query("""SELECT a.* FROM sharing.card_artwork a JOIN sharing.shared_card s ON s.campaign=a.campaign AND s.content=a.content
        WHERE s.campaign=? AND s.id=? AND s.state='ACTIVE' AND a.variant='DISPLAY' AND a.role=?""",{r,_->
        ImageDerivative(ImageLimits.POLICY,ImageVariant.DISPLAY,r.getString("mime"),r.getInt("width"),r.getInt("height"),ImageBytes(r.getBytes("bytes")))
    },campaign,card,if(details) "DETAILS" else "FRONT").singleOrNull()
}
