package workbench.sharing.adapter.persistence

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import workbench.platform.api.*
import workbench.preparation.api.PreparedCard
import workbench.sharing.api.*
import workbench.sharing.application.SharedCardStore
import workbench.sources.api.CardLayoutInput
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

@Repository
class JdbcSharedCardStore(private val jdbc: JdbcTemplate, private val mapper: ObjectMapper) : SharedCardStore {
    private val select = """SELECT s.*,c.visible,EXISTS(SELECT 1 FROM sharing.card_artwork a WHERE a.campaign=s.campaign AND a.content=s.content) AS artwork
        FROM sharing.shared_card s JOIN sharing.card_content c ON c.campaign=s.campaign AND c.id=s.content"""
    private fun ResultSet.data() = SharedCardData(getObject("id", UUID::class.java),
        mapper.readValue(getString("visible"), CardLayoutInput::class.java), SharingMode.valueOf(getString("mode")), getBoolean("artwork"))
    override fun operation(campaign: UUID, operation: UUID) = jdbc.query(
        "SELECT parameters,card FROM sharing.distribution WHERE campaign=? AND operation=?",
        { r, _ -> mapper.readValue(r.getString("parameters"), DistributeCard::class.java) to r.getObject("card", UUID::class.java) }, campaign, operation).singleOrNull()
    override fun insert(campaign: UUID, request: DistributeCard, source: PreparedCard, now: Instant): SharedCardData {
        val id=UUID.randomUUID()
        jdbc.update("INSERT INTO sharing.card_content(campaign,id,visible,provenance) VALUES (?,?,?::jsonb,?::jsonb)",
            campaign,id,mapper.writeValueAsString(source.visible),mapper.writeValueAsString(source.provenance))
        source.artwork?.derivatives?.forEach { image ->
            jdbc.update("INSERT INTO sharing.card_artwork(campaign,content,variant,mime,width,height,bytes) VALUES (?,?,?,?,?,?,?)",
                campaign,id,image.variant.name,image.mime,image.width,image.height,image.content.copy())
        }
        val position=jdbc.queryForObject("SELECT COALESCE(max(position),0)+1 FROM sharing.shared_card WHERE campaign=? AND recipient IS NOT DISTINCT FROM ?::uuid AND state='ACTIVE'",Long::class.java,campaign,request.recipient)!!
        jdbc.update("INSERT INTO sharing.shared_card(campaign,id,content,recipient,mode,position) VALUES (?,?,?,?,?,?)",campaign,id,id,request.recipient,request.mode.name,position)
        jdbc.update("INSERT INTO sharing.distribution(campaign,operation,parameters,card) VALUES (?,?,?::jsonb,?)",campaign,request.operation,mapper.writeValueAsString(request),id)
        jdbc.update("INSERT INTO sharing.card_event(campaign,card,kind,recipient,occurred_at) VALUES (?,?,'DISTRIBUTED',?,?)",campaign,id,request.recipient,Timestamp.from(now))
        return SharedCardData(id,source.visible,request.mode,source.artwork!=null)
    }
    override fun cards(campaign: UUID, recipient: UUID?) = jdbc.query("$select WHERE s.campaign=? AND s.recipient IS NOT DISTINCT FROM ?::uuid AND s.state='ACTIVE' ORDER BY s.position,s.id",{r,_->r.data()},campaign,recipient)
    override fun card(campaign: UUID, card: UUID) = jdbc.query("$select WHERE s.campaign=? AND s.id=? AND s.state='ACTIVE'",{r,_->r.getObject("recipient",UUID::class.java) to r.data()},campaign,card).singleOrNull()
    override fun artwork(campaign: UUID, card: UUID) = jdbc.query("""SELECT a.* FROM sharing.card_artwork a JOIN sharing.shared_card s ON s.campaign=a.campaign AND s.content=a.content
        WHERE s.campaign=? AND s.id=? AND s.state='ACTIVE' AND a.variant='DISPLAY'""",{r,_->
        ImageDerivative(ImageLimits.POLICY,ImageVariant.DISPLAY,r.getString("mime"),r.getInt("width"),r.getInt("height"),ImageBytes(r.getBytes("bytes")))
    },campaign,card).singleOrNull()
}
