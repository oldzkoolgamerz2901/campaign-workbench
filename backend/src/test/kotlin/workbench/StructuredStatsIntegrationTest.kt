package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.context.ConfigurableApplicationContext
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.preparation.api.*
import workbench.preparation.application.PreparationService
import workbench.sessionarchives.application.PortableSessionService
import workbench.sharing.api.*
import workbench.sharing.application.*
import workbench.writing.api.*
import workbench.writing.application.*
import java.nio.file.Files
import java.util.UUID

class StructuredStatsIntegrationTest : StringSpec({
    val db = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("structured-stats")
    var context: ConfigurableApplicationContext? = null
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${db.jdbcUrl}", "--spring.datasource.username=${db.username}", "--spring.datasource.password=${db.password}")
    fun writing() = context!!.getBean(WritingService::class.java)
    fun preparation() = context!!.getBean(PreparationService::class.java)
    val stats = DraftStats(subtitle = "Medium Humanoid", ac = "17", hp = "59 (8d8 + 23)", initiative = "+4 (14)", cr = "1/8 (PB +2)",
        abilities = mapOf("STR" to DraftAbility("8", "-1", "+2")), vulnerabilities = "Fire", immunities = "Poison",
        sections = listOf(DraftStatSection("Traits", listOf(DraftStatEntry("Watchful", "PRIVATE_STAT_TRAIT"))),
            DraftStatSection("Actions", listOf(DraftStatEntry(spellcasting = DraftSpellcasting("Wisdom", "17", "At will: Light"))))))
    fun fresh(): DraftData {
        val path = Files.createDirectory(root.resolve(UUID.randomUUID().toString()))
        val campaign = context!!.getBean(CampaignService::class.java).register(RegisterCampaign("Stats", path.toString())).getOrNull()!!.id
        val d = writing().create(campaign, CreateDraft("npc", false)).getOrNull()!!
        return writing().save(campaign, d.id, SaveDraft(d.revision, d.fields.copy(title = "Keeper", path = "keeper.md", backText = "PRIVATE_BACK", stats = stats))).getOrNull()!!
    }
    fun freeze(d: DraftData): SessionData {
        val s = preparation().create(d.campaign, CreateSession("Frozen", "")).getOrNull()!!
        return preparation().addDraft(d.campaign, s.id, AddDraft(s.revision, d.id, d.revision)).getOrNull()!!
    }
    beforeSpec { db.start(); context = start() }
    afterSpec { context?.close(); db.stop(); root.toFile().deleteRecursively() }

    "WSD-R9 CD5 stats save atomically with text, reject stale and invalid edits, preserve retained revisions and restart" {
        val d = fresh()
        writing().open(d.campaign, d.id).getOrNull()!!.fields.stats shouldBe stats
        val approved = context!!.getBean(SessionDrafts::class.java).retain(d.campaign, d.id, d.revision).getOrNull()!!
        approved.snapshot.fields.stats shouldBe stats
        writing().save(d.campaign, d.id, SaveDraft(d.revision - 1, d.fields.copy(stats = null))).isLeft() shouldBe true
        writing().save(d.campaign, d.id, SaveDraft(d.revision, d.fields.copy(stats = stats.copy(abilities = mapOf("LUCK" to DraftAbility()))))).isLeft() shouldBe true
        writing().save(d.campaign, d.id, SaveDraft(d.revision, d.fields.copy(stats = stats.copy(sections = List(33) { DraftStatSection() })))).isLeft() shouldBe true
        writing().save(d.campaign, d.id, SaveDraft(d.revision, d.fields.copy(stats = stats.copy(hp = "x".repeat(16385))))).isLeft() shouldBe true
        writing().open(d.campaign, d.id).getOrNull() shouldBe d
        val changed = writing().save(d.campaign, d.id, SaveDraft(d.revision, d.fields.copy(stats = null, backText = "Still here"))).getOrNull()!!
        changed.fields.stats shouldBe null
        changed.fields.backText shouldBe "Still here"
        context!!.close(); context = start()
        writing().open(d.campaign, d.id).getOrNull() shouldBe changed
        context!!.getBean(ApprovedRevisionStore::class.java).get(d.campaign, d.id, d.revision)!!.snapshot.fields.stats shouldBe stats
    }

    "CD5 stats freeze independently, invalidate stale distribution review, reveal same frozen instance and survive restart" {
        val d = fresh()
        var s = freeze(d)
        val item = s.items.single()
        item.stats!!.hp shouldBe stats.hp
        val distribution = context!!.getBean(DistributionService::class.java)
        val review = distribution.preview(d.campaign, PreviewSharedCard(s.id, item.id)).getOrNull()!!
        review.visible.stats!!.sections.first().entries.first().text shouldBe "PRIVATE_STAT_TRAIT"
        val req = DistributeCard(UUID.randomUUID(), s.id, item.id, review.fingerprint, SharingMode.INVENTORY, null)
        val card = distribution.distribute(d.campaign, req).getOrNull()!!
        val changed = writing().save(d.campaign, d.id, SaveDraft(d.revision, d.fields.copy(stats = stats.copy(ac = "20")))).getOrNull()!!
        s = preparation().replaceDraft(d.campaign, s.id, item.id, AddDraft(s.revision, changed.id, changed.revision)).getOrNull()!!
        s.items.single().stats!!.ac shouldBe "20"
        distribution.distribute(d.campaign, req.copy(operation = UUID.randomUUID())).isLeft() shouldBe true
        distribution.distribute(d.campaign, req).getOrNull()!!.id shouldBe card.id
        val sharing = context!!.getBean(SharingService::class.java)
        val player = sharing.add(d.campaign, AddCampaignPlayer("Reader")).getOrNull()!!
        val invite = sharing.invite(d.campaign, player.id).getOrNull()!!
        val device = sharing.redeem(d.campaign, invite.token).getOrNull()!!
        val reader = context!!.getBean(PlayerCards::class.java)
        reader.collections(d.campaign, device.credential).getOrNull()!!.group.cards.single().visible.stats shouldBe null
        reader.layout(d.campaign, device.credential, card.id).getOrNull()!!.back.lines.none { it.field.startsWith("stats.") } shouldBe true
        context!!.getBean(CardLifecycleService::class.java).revealBack(d.campaign, card.id).getOrNull()!!.id shouldBe card.id
        reader.collections(d.campaign, device.credential).getOrNull()!!.group.cards.single().visible.stats!!.ac shouldBe "17"
        preparation().save(d.campaign, s.id, SaveSession(s.revision, s.title, s.objective, s.notes, emptyList())).isRight() shouldBe true
        writing().delete(changed.campaign, changed.id, changed.revision).isRight() shouldBe true
        context!!.close(); context = start()
        context!!.getBean(PlayerCards::class.java).collections(d.campaign, device.credential).getOrNull()!!.group.cards.single().visible.stats!!.hp shouldBe stats.hp
    }

    "WCP-R2 CD5 stats round trip Writing JSON ZIP and session archives with strict version shape and rollback" {
        val d = fresh()
        val recovery = context!!.getBean(RecoveryService::class.java)
        val bytes = recovery.backup(d.campaign).getOrNull()!!
        val restored = recovery.restore(bytes).getOrNull()!!
        recovery.workspace(restored.id).getOrNull()!!.drafts.single().fields.stats shouldBe stats
        recovery.copy(restored.id, CopyRecovery(d.id, d.campaign)).getOrNull()!!.fields.stats shouldBe stats
        val portable = context!!.getBean(PortableWritingService::class.java)
        val zip = portable.backup(d.campaign).getOrNull()!!.use { it.input().use { it.readAllBytes() } }
        val zipped = portable.restore(zip.inputStream()).getOrNull()!!
        recovery.workspace(zipped.id).getOrNull()!!.drafts.all { it.fields.stats == stats } shouldBe true
        val mapper = context!!.getBean(ObjectMapper::class.java)
        val count = recovery.list().workspaces.size
        val tree = mapper.readTree(bytes) as ObjectNode
        tree.put("version", 9)
        recovery.restore(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
        tree.put("version", 11)
        ((tree.path("drafts")[0].path("fields").path("stats")) as ObjectNode).put("unexpected", "bad")
        recovery.restore(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
        recovery.list().workspaces.size shouldBe count
        val s = freeze(d)
        val archives = context!!.getBean(PortableSessionService::class.java)
        val manifest = archives.manifest(d.campaign, ExportSessions(listOf(s.id))).getOrNull()!!
        manifest.version shouldBe 14
        val codec = context!!.getBean(workbench.sessionarchives.application.SessionArchiveCodec::class.java)
        val encoded = codec.writeTransfer(manifest)
        codec.readTransfer(encoded).getOrNull()!!.sessions.single().items.single().stats shouldBe s.items.single().stats
        val sessionZip = archives.export(d.campaign, ExportSessions(listOf(s.id))).getOrNull()!!.use { it.input().use { it.readAllBytes() } }
        val imported = archives.import(d.campaign, sessionZip.inputStream()).getOrNull()!!.sessions.single()
        preparation().open(d.campaign, imported.id).getOrNull()!!.items.single().stats shouldBe s.items.single().stats
        val wrong = mapper.readTree(encoded) as ObjectNode
        wrong.put("version", 13)
        codec.readTransfer(mapper.writeValueAsBytes(wrong)).isLeft() shouldBe true
        preparation().import(d.campaign, Archive(13, listOf(s))).isLeft() shouldBe true
        val report = context!!.getBean(WritingExportService::class.java).inspect(d.campaign, d.id, InspectExport(d.revision, null)).getOrNull()!!
        report.warnings.any { it.contains("Markdown does not include structured stats") } shouldBe true
    }
})
