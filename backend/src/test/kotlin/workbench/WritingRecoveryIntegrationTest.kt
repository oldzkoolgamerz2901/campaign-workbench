package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.platform.api.*
import workbench.sources.application.SourceService
import workbench.writing.api.*
import workbench.writing.application.*
import java.nio.file.Files
import java.util.UUID

class WritingRecoveryIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("writing-recovery")
    val destination = Files.createTempDirectory("writing-resume")
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    var context: org.springframework.context.ConfigurableApplicationContext? = null
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively(); destination.toFile().deleteRecursively() }
    "detached recovery retains incomplete drafts, orphan approvals and immutable exports without sources; copy requires new identities" {
        val c = context!!
        val campaigns = c.getBean(CampaignService::class.java)
        val campaign = campaigns.register(RegisterCampaign("Recovery origin", root.toString())).getOrNull()!!.id
        val other = campaigns.register(RegisterCampaign("Recovery destination", destination.toString())).getOrNull()!!.id
        val writing = c.getBean(WritingService::class.java)
        val source = c.getBean(SourceService::class.java)
        val exports = c.getBean(WritingExportService::class.java)
        val recovery = c.getBean(RecoveryService::class.java)
        val codec = c.getBean(RecoveryCodec::class.java)
        val tx = c.getBean(Transactions::class.java)
        val jdbc = c.getBean(org.springframework.jdbc.core.JdbcTemplate::class.java)
        Files.writeString(root.resolve("original.md"), "# Original\r\nExact source evidence.")
        val capture = source.refresh(campaign).getOrNull()!!.capture!!
        val fork = exports.fork(campaign, ForkDraft(capture, "original.md", "scene")).getOrNull()!!
        val saved = writing.save(campaign, fork.id, SaveDraft(0, fork.fields.copy(title = "Recovered scene", path = "scene.md", body = "# Scene\n[local](#scene)"))).getOrNull()!!
        val report = exports.inspect(campaign, saved.id, InspectExport(saved.revision, capture)).getOrNull()!!
        val exported = exports.create(campaign, saved.id, CreateExport(saved.revision, capture, report.fingerprint, true)).getOrNull()!!
        val retained = c.getBean(SessionDrafts::class.java).retain(campaign, saved.id, saved.revision).getOrNull()!!
        val incomplete = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        val orphan = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        val orphanSaved = writing.save(campaign, orphan.id, SaveDraft(0, orphan.fields.copy(title = "Retained only"))).getOrNull()!!
        c.getBean(SessionDrafts::class.java).retain(campaign, orphan.id, 1).isRight() shouldBe true
        jdbc.update("DELETE FROM writing.draft WHERE id = ?", orphan.id)
        val changed = writing.save(campaign, saved.id, SaveDraft(saved.revision, saved.fields.copy(body = "# Later\nCurrent body"))).getOrNull()!!
        val bytes = recovery.backup(campaign).getOrNull()!!
        val archive = codec.read(bytes)
        archive.drafts.size shouldBe 2
        archive.approved.size shouldBe 2
        archive.exports.single().report.markdown shouldBe exported.report.markdown
        archive.drafts.single { it.id == incomplete.id }.fields.title shouldBe ""
        val before = recovery.list().workspaces.size
        tx.run<Unit> { recovery.restore(bytes).isRight() shouldBe true; Either.Left(Failure.Invalid("test.rollback", "rollback")) }.isLeft() shouldBe true
        recovery.list().workspaces.size shouldBe before
        Files.delete(root.resolve("original.md"))
        // Remove all live Writing records. Source rows still own their original registration.
        jdbc.update("DELETE FROM writing.export_artifact WHERE campaign = ?", campaign)
        jdbc.update("DELETE FROM writing.approved_revision WHERE campaign = ?", campaign)
        jdbc.update("DELETE FROM writing.draft WHERE campaign = ?", campaign)
        // A full archive carrying a campaign UUID absent from this database restores without lookup.
        val absentCampaign = UUID.randomUUID()
        val detachedBytes = codec.write(archive.copy(campaign = absentCampaign,
            drafts = archive.drafts.map { it.copy(campaign = absentCampaign) },
            approved = archive.approved.map { it.copy(snapshot = it.snapshot.copy(campaign = absentCampaign)) },
            exports = archive.exports.map { it.copy(snapshot = it.snapshot.copy(campaign = absentCampaign)) }))
        recovery.restore(detachedBytes).isRight() shouldBe true
        val restored = recovery.restore(bytes).getOrNull()!!
        val second = recovery.restore(bytes).getOrNull()!!
        (restored.id != second.id) shouldBe true
        codec.read(recovery.archive(restored.id).getOrNull()!!) shouldBe archive
        val detail = recovery.detail(restored.id, "export:${exported.id}").getOrNull()!!
        detail.markdown shouldBe exported.report.markdown
        detail.hash shouldBe exported.report.hash
        recovery.detail(restored.id, "approved:${orphanSaved.id}:1").getOrNull()!!.snapshot shouldBe orphanSaved
        recovery.detail(restored.id, "approved:${saved.id}:1").getOrNull()!!.markdown shouldBe retained.markdown
        val initialDestination = writing.list(other).getOrNull()!!.drafts
        tx.run<Unit> { recovery.copy(restored.id, CopyRecovery(changed.id, other)).isRight() shouldBe true; Either.Left(Failure.Invalid("test.rollback", "rollback")) }.isLeft() shouldBe true
        writing.list(other).getOrNull()!!.drafts shouldBe initialDestination
        val copy = recovery.copy(restored.id, CopyRecovery(changed.id, other)).getOrNull()!!
        (copy.id != changed.id && copy.card != changed.card) shouldBe true
        copy.revision shouldBe 0
        copy.fields shouldBe changed.fields
        copy.origin shouldBe changed.origin
        copy.recovery!!.workspace shouldBe restored.id
        c.getBean(ApprovedRevisionStore::class.java).get(other, copy.id, 0) shouldBe null
        exports.history(other, copy.id).getOrNull()!!.artifacts.size shouldBe 0
        val copiedAgain = recovery.copy(restored.id, CopyRecovery(changed.id, other)).getOrNull()!!
        (copiedAgain.id != copy.id) shouldBe true
        val savedCopy = writing.save(other, copy.id, SaveDraft(0, copy.fields.copy(summary = "Resumed"))).getOrNull()!!
        savedCopy.recovery shouldBe copy.recovery
        c.getBean(SessionDrafts::class.java).retain(other, savedCopy.id, 1).isRight() shouldBe true
        // Recovery provenance also survives another backup/restore generation.
        recovery.restore(recovery.backup(other).getOrNull()!!).isRight() shouldBe true
        context!!.close(); context = start()
        context!!.getBean(RecoveryService::class.java).detail(restored.id, "export:${exported.id}").getOrNull()!!.markdown shouldBe detail.markdown
        context!!.getBean(WritingService::class.java).open(other, copy.id).getOrNull() shouldBe savedCopy
    }
    "strict wire and domain failures create no partial workspace, while missing external history is valid" {
        val recovery = context!!.getBean(RecoveryService::class.java)
        val codec = context!!.getBean(RecoveryCodec::class.java)
        val mapper = context!!.getBean(ObjectMapper::class.java)
        val workspace = recovery.list().workspaces.first { it.exports > 0 }
        val original = recovery.archive(workspace.id).getOrNull()!!
        val archive = codec.read(original)
        val count = recovery.list().workspaces.size
        fun bad(change: (ObjectNode) -> Unit) {
            val tree = mapper.readTree(original) as ObjectNode
            change(tree)
            recovery.restore(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
            recovery.list().workspaces.size shouldBe count
        }
        bad { it.put("version", 2) }
        bad { it.put("version", "1") }
        bad { it.put("unexpected", true) }
        bad { it.remove("approved") }
        bad { (it.path("drafts")[0] as ObjectNode).put("revision", -1) }
        bad { (it.path("drafts")[0] as ObjectNode).put("id", "1-1-1-1-1") }
        bad { (it.path("exports")[0].path("report") as ObjectNode).put("markdown", "tampered") }
        bad { (it.path("approved")[0] as ObjectNode).put("hash", "0".repeat(64)) }
        bad { (it.path("drafts").first { d -> !d.path("origin").isNull }.path("origin") as ObjectNode).put("raw", "wrong") }
        bad { (it.path("drafts")[0].path("fields") as ObjectNode).put("body", "x".repeat(2 * 1024 * 1024 + 1)) }
        bad { it.withArray("drafts").add(it.path("drafts")[0]) }
        bad { it.withArray("approved").add(it.path("approved")[0]) }
        bad { it.withArray("exports").add(it.path("exports")[0]) }
        recovery.restore(original + "{}".toByteArray()).isLeft() shouldBe true
        recovery.restore(String(original).replaceFirst("\"version\":3", "\"version\":3,\"version\":3").toByteArray()).isLeft() shouldBe true
        recovery.restore(byteArrayOf(0xc3.toByte(), 0x28)).isLeft() shouldBe true
        recovery.restore(ByteArray(RECOVERY_BYTES + 1) { 32 }).isLeft() shouldBe true
        recovery.restore(codec.write(archive.copy(drafts = List(1001) { archive.drafts.first() }))).isLeft() shouldBe true
        recovery.restore(codec.write(archive.copy(approved = List(10001) { archive.approved.first() }))).isLeft() shouldBe true
        recovery.list().workspaces.size shouldBe count
        val first = archive.approved.first().snapshot
        recovery.restore(codec.write(archive.copy(drafts = listOf(first.copy(fields = first.fields.copy(title = "Conflict")))))).isLeft() shouldBe true
    }
    "snapshot locks serialize a competing save and persistence failure rolls back the workspace" {
        val c = context!!
        val campaigns = c.getBean(CampaignService::class.java)
        val campaign = campaigns.register(RegisterCampaign("Snapshot lock", Files.createDirectory(root.resolve("lock")).toString())).getOrNull()!!.id
        val writing = c.getBean(WritingService::class.java)
        val draft = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        val source = c.getBean(RecoverySource::class.java)
        val store = c.getBean(RecoveryStore::class.java)
        val codec = c.getBean(RecoveryCodec::class.java)
        val authoring = c.getBean(workbench.sources.api.Authoring::class.java)
        val tx = c.getBean(Transactions::class.java)
        val entered = java.util.concurrent.CountDownLatch(1)
        val release = java.util.concurrent.CountDownLatch(1)
        val blocked = object : RecoverySource by source {
            override fun size(campaign: UUID): RecoverySize { entered.countDown(); check(release.await(5, java.util.concurrent.TimeUnit.SECONDS)); return source.size(campaign) }
        }
        val backup = RecoveryService(campaigns, c.getBean(DraftStore::class.java), blocked, store, codec, authoring, tx)
        val executor = java.util.concurrent.Executors.newFixedThreadPool(2)
        try {
            val snapshot = executor.submit<ByteArray> { backup.backup(campaign).getOrNull()!! }
            check(entered.await(5, java.util.concurrent.TimeUnit.SECONDS))
            val saveStarted = java.util.concurrent.CountDownLatch(1)
            val saved = executor.submit<DraftData> { saveStarted.countDown(); writing.save(campaign, draft.id, SaveDraft(0, draft.fields.copy(title = "Concurrent save"))).getOrNull()!! }
            check(saveStarted.await(5, java.util.concurrent.TimeUnit.SECONDS))
            try { saved.get(100, java.util.concurrent.TimeUnit.MILLISECONDS); error("Save bypassed campaign lock") } catch (_: java.util.concurrent.TimeoutException) { }
            release.countDown()
            codec.read(snapshot.get(5, java.util.concurrent.TimeUnit.SECONDS)).drafts.single() shouldBe draft
            saved.get(5, java.util.concurrent.TimeUnit.SECONDS).revision shouldBe 1
        } finally { release.countDown(); executor.shutdownNow() }
        val recovery = c.getBean(RecoveryService::class.java)
        val bytes = recovery.backup(campaign).getOrNull()!!
        val before = store.list().size
        val failing = object : RecoveryStore by store {
            override fun put(summary: RecoverySummary, archive: WritingArchive) { store.put(summary, archive); error("Injected persistence failure after insert") }
        }
        val service = RecoveryService(campaigns, c.getBean(DraftStore::class.java), source, failing, codec, authoring, tx)
        try { service.restore(bytes); error("Expected injected failure") } catch (e: IllegalStateException) { e.message shouldBe "Injected persistence failure after insert" }
        store.list().size shouldBe before
        val full = codec.read(bytes)
        val padded = bytes + ByteArray(RECOVERY_BYTES - bytes.size) { 32 }
        recovery.restore(padded).isRight() shouldBe true // exact byte boundary, without huge field values
        val many = full.copy(drafts = List(1000) { full.drafts.single().copy(id = UUID.randomUUID(), card = UUID.randomUUID()) })
        recovery.restore(codec.write(many)).isRight() shouldBe true
        val fakeLarge = object : RecoverySource by source { override fun size(campaign: UUID) = RecoverySize(1001, 0, 0) }
        RecoveryService(campaigns, c.getBean(DraftStore::class.java), fakeLarge, store, codec, authoring, tx).backup(campaign).isLeft() shouldBe true
    }

})
