package workbench.writing.adapter.persistence

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import workbench.writing.api.SourceAssociationData
import workbench.writing.application.SourceAssociationStore
import java.util.UUID

@Repository
class JdbcSourceAssociationStore(private val jdbc: JdbcTemplate) : SourceAssociationStore {
    override fun list(campaign: UUID) = jdbc.query(
        "SELECT card,path,declared_id,capture,hash FROM writing.source_association WHERE campaign=? ORDER BY card",
        { r, _ -> SourceAssociationData(r.getObject("card", UUID::class.java), r.getString("path"), r.getObject("declared_id", UUID::class.java), r.getObject("capture", UUID::class.java), r.getString("hash")) }, campaign)
    override fun put(campaign: UUID, association: SourceAssociationData) {
        jdbc.update("""INSERT INTO writing.source_association(campaign,card,path,declared_id,capture,hash) VALUES (?,?,?,?,?,?)
            ON CONFLICT (campaign,card) DO UPDATE SET path=excluded.path,declared_id=excluded.declared_id,capture=excluded.capture,hash=excluded.hash""",
            campaign, association.card, association.path, association.declaredId, association.capture, association.hash)
    }
}
