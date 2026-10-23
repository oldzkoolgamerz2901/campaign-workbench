package workbench.writing.adapter.persistence

import org.springframework.stereotype.Repository
import org.springframework.jdbc.core.JdbcTemplate
import tools.jackson.databind.ObjectMapper
import workbench.writing.api.*
import workbench.sources.api.CheckedLink
import workbench.writing.application.*
import workbench.writing.domain.ExportArtifact
import java.util.UUID

@Repository
class JdbcRecoverySource(private val jdbc: JdbcTemplate, private val mapper: ObjectMapper, private val associations: SourceAssociationStore) : RecoverySource {
    override fun associations(campaign: UUID) = associations.list(campaign)
    override fun size(campaign: UUID): RecoverySize {
        fun count(table: String) = jdbc.queryForObject("SELECT count(*) FROM writing.$table WHERE campaign = ?", Long::class.java, campaign)!!
        fun bytes(table: String, expression: String) = jdbc.queryForObject("SELECT coalesce(sum($expression),0) FROM writing.$table WHERE campaign = ?", Long::class.java, campaign)!!
        return RecoverySize(count("draft"), count("approved_revision") + count("export_artifact") + count("source_association"),
            bytes("draft", "octet_length(title)+octet_length(type)+octet_length(status)+octet_length(tags)+octet_length(summary)+octet_length(body)+octet_length(path)+coalesce(octet_length(origin),0)+coalesce(octet_length(recovery),0)") +
            bytes("approved_revision", "octet_length((payload::jsonb - 'preview')::text)") + bytes("export_artifact", "octet_length(payload)") + bytes("source_association", "octet_length(path)+256"))
    }
    override fun approved(campaign: UUID) = jdbc.query("SELECT (payload::jsonb - 'preview')::text FROM writing.approved_revision WHERE campaign = ? ORDER BY draft, revision", { r, _ -> mapper.readValue(r.getString(1), RecoveryApproval::class.java) }, campaign)
    override fun exports(campaign: UUID) = jdbc.query("SELECT payload FROM writing.export_artifact WHERE campaign = ? ORDER BY id", { r, _ ->
        val a = mapper.readValue(r.getString(1), ExportArtifact::class.java)
        RecoveryExport(a.id, draftDataForArchive(a), a.createdAt, ExportInspection(a.snapshot.revision, a.capture, a.snapshot.path, a.markdown, a.hash, a.fingerprint, emptyList(), a.warnings,
            a.links.map { CheckedLink(it.key, it.destination, it.kind, it.path, it.anchor, it.section, it.external, it.draft, it.revision, it.warning) }, a.targetRevisions), a.acknowledged)
    }, campaign)
    private fun draftDataForArchive(a: ExportArtifact) = workbench.writing.application.draftData(a.snapshot)
}

@Repository
class JdbcRecoveryStore(private val jdbc: JdbcTemplate, private val mapper: ObjectMapper) : RecoveryStore {
    private val row = org.springframework.jdbc.core.RowMapper { r, _: Int -> RecoverySummary(r.getObject("id", UUID::class.java), r.getString("name"), r.getString("restored_at"), r.getInt("drafts"), r.getInt("approved"), r.getInt("exports")) }
    override fun list() = jdbc.query("SELECT id,name,restored_at,drafts,approved,exports FROM writing.recovery_workspace ORDER BY restored_at DESC", row)
    override fun summary(id: UUID) = jdbc.query("SELECT id,name,restored_at,drafts,approved,exports FROM writing.recovery_workspace WHERE id = ?", row, id).singleOrNull()
    override fun get(id: UUID) = jdbc.query("SELECT payload FROM writing.recovery_workspace WHERE id = ?", { r, _ -> mapper.readValue(r.getString(1), WritingArchive::class.java) }, id).singleOrNull()
    override fun put(summary: RecoverySummary, archive: WritingArchive) {
        jdbc.update("INSERT INTO writing.recovery_workspace(id,name,restored_at,drafts,approved,exports,payload) VALUES (?,?,?,?,?,?,?)", summary.id, summary.name, summary.restoredAt, summary.drafts, summary.approved, summary.exports, mapper.writeValueAsString(archive))
    }
}
