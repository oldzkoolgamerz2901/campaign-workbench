package workbench.sharing.adapter.persistence

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import workbench.sharing.application.SharingStore
import workbench.sharing.domain.*
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

@Repository
class JdbcSharingStore(private val jdbc: JdbcTemplate) : SharingStore {
    private fun ResultSet.player() = CampaignPlayer(getObject("id", UUID::class.java), getObject("campaign", UUID::class.java), getString("display_name"), getBoolean("active"))
    private fun ResultSet.device() = PairedDevice(getObject("id", UUID::class.java), getObject("campaign", UUID::class.java), getObject("player", UUID::class.java), getString("credential_hash"),
        getTimestamp("created_at").toInstant(), getTimestamp("last_seen_at").toInstant(), getTimestamp("revoked_at")?.toInstant())
    override fun deviceCounts(campaign: UUID) = jdbc.query("SELECT player,count(*) AS total FROM sharing.device WHERE campaign=? AND revoked_at IS NULL GROUP BY player", { r, _ -> r.getObject("player",UUID::class.java) to r.getInt("total") }, campaign).toMap()
    private fun ResultSet.invitation() = PairingInvitation(getObject("campaign",UUID::class.java),getObject("player",UUID::class.java),getString("token_hash"),getTimestamp("created_at").toInstant(),getTimestamp("expires_at").toInstant(),getTimestamp("consumed_at")?.toInstant(),getObject("id",UUID::class.java),getTimestamp("invalidated_at")?.toInstant())
    override fun invitationById(campaign: UUID, player: UUID, id: UUID) = jdbc.query("SELECT * FROM sharing.invitation WHERE campaign=? AND player=? AND id=?",{ r, _ -> r.invitation() },campaign,player,id).singleOrNull()
    override fun invalidate(campaign: UUID, id: UUID, now: Instant) = jdbc.update("UPDATE sharing.invitation SET invalidated_at=? WHERE campaign=? AND id=? AND invalidated_at IS NULL",Timestamp.from(now),campaign,id)==1
    override fun players(campaign: UUID) = jdbc.query("SELECT * FROM sharing.player WHERE campaign=? ORDER BY lower(display_name),id", { r, _ -> r.player() }, campaign)
    override fun player(campaign: UUID, id: UUID) = jdbc.query("SELECT * FROM sharing.player WHERE campaign=? AND id=?", { r, _ -> r.player() }, campaign, id).singleOrNull()
    override fun put(player: CampaignPlayer) {
        check(jdbc.update("""INSERT INTO sharing.player(id,campaign,display_name,active) VALUES (?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,active=EXCLUDED.active
            WHERE sharing.player.campaign=EXCLUDED.campaign""", player.id, player.campaign, player.displayName, player.active) == 1)
    }
    override fun put(invitation: PairingInvitation) {
        jdbc.update("INSERT INTO sharing.invitation(campaign,player,token_hash,created_at,expires_at,consumed_at,id,invalidated_at) VALUES (?,?,?,?,?,?,?,?)",
            invitation.campaign, invitation.player, invitation.tokenHash, Timestamp.from(invitation.createdAt), Timestamp.from(invitation.expiresAt), invitation.consumedAt?.let(Timestamp::from), invitation.id, invitation.invalidatedAt?.let(Timestamp::from))
    }
    override fun invitation(campaign: UUID, hash: String) = jdbc.query("SELECT * FROM sharing.invitation WHERE campaign=? AND token_hash=?", { r, _ -> r.invitation() },campaign,hash).singleOrNull()
    override fun consume(campaign: UUID, hash: String, now: Instant) = jdbc.update(
        "UPDATE sharing.invitation SET consumed_at=? WHERE campaign=? AND token_hash=? AND consumed_at IS NULL AND invalidated_at IS NULL AND expires_at>?",
        Timestamp.from(now), campaign, hash, Timestamp.from(now)) == 1
    override fun devices(campaign: UUID, player: UUID) = jdbc.query("SELECT * FROM sharing.device WHERE campaign=? AND player=? ORDER BY created_at,id", { r, _ -> r.device() }, campaign, player)
    override fun device(campaign: UUID, id: UUID) = jdbc.query("SELECT * FROM sharing.device WHERE campaign=? AND id=?", { r, _ -> r.device() }, campaign, id).singleOrNull()
    override fun credential(campaign: UUID, hash: String) = jdbc.query("SELECT * FROM sharing.device WHERE campaign=? AND credential_hash=?", { r, _ -> r.device() }, campaign, hash).singleOrNull()
    override fun put(device: PairedDevice) {
        check(jdbc.update("""INSERT INTO sharing.device(id,campaign,player,credential_hash,created_at,last_seen_at,revoked_at) VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET last_seen_at=GREATEST(sharing.device.last_seen_at,EXCLUDED.last_seen_at),
                revoked_at=COALESCE(sharing.device.revoked_at,EXCLUDED.revoked_at)
            WHERE sharing.device.campaign=EXCLUDED.campaign AND sharing.device.player=EXCLUDED.player AND sharing.device.credential_hash=EXCLUDED.credential_hash""",
            device.id, device.campaign, device.player, device.credentialHash, Timestamp.from(device.createdAt), Timestamp.from(device.lastSeenAt), device.revokedAt?.let(Timestamp::from)) == 1)
    }
}
