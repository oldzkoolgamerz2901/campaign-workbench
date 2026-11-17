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
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.PreparationService
import workbench.preparation.application.PreparedArtworkService
import workbench.sessionarchives.application.PortableSessionService
import workbench.sharing.api.*
import workbench.sharing.application.*
import workbench.writing.api.*
import workbench.writing.application.*
import java.nio.file.Files
import java.util.UUID

class DetailsImageIntegrationTest : StringSpec({
    val db = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("details-images")
    var context: ConfigurableApplicationContext? = null
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${db.jdbcUrl}", "--spring.datasource.username=${db.username}", "--spring.datasource.password=${db.password}")
    fun writing() = context!!.getBean(WritingService::class.java)
    fun preparation() = context!!.getBean(PreparationService::class.java)
    fun fresh(): DraftData {
        val path = Files.createDirectory(root.resolve(UUID.randomUUID().toString()))
        val campaign = context!!.getBean(CampaignService::class.java).register(RegisterCampaign("Details", path.toString())).getOrNull()!!.id
        val d = writing().create(campaign, CreateDraft("npc", false)).getOrNull()!!
        return writing().save(campaign, d.id, SaveDraft(d.revision, d.fields.copy(title = "Map keeper", path = "keeper.md", backText = "PRIVATE_BACK", body = "# Private body"))).getOrNull()!!
    }
    fun front(d: DraftData) = writing().replaceImage(d.campaign, d.id, SaveDraft(d.revision, d.fields, imageAction = "replace"), ImageFixtures.png(60, 120).inputStream()).getOrNull()!!
    fun details(d: DraftData, width: Int = 240) = writing().replaceImage(d.campaign, d.id, SaveDraft(d.revision, d.fields, detailsImageAction = "replace"), ImageFixtures.png(width, 80).inputStream(), true).getOrNull()!!
    fun omitImage(bytes: ByteArray, hash: String): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        java.util.zip.ZipOutputStream(out).use { zip ->
            java.util.zip.ZipInputStream(bytes.inputStream()).use { source ->
                while (true) {
                    val entry = source.nextEntry ?: break
                    val content = source.readAllBytes()
                    if (entry.name != "images/$hash") {
                        zip.putNextEntry(java.util.zip.ZipEntry(entry.name)); zip.write(content); zip.closeEntry()
                    }
                }
            }
        }
        return out.toByteArray()
    }
    beforeSpec { db.start(); context = start() }
    afterSpec { context?.close(); db.stop(); root.toFile().deleteRecursively() }

    "CD4 image edits are revisioned and failed or stale uploads preserve both images and retained frozen history" {
        val original = details(front(fresh()))
        val artwork = context!!.getBean(ArtworkService::class.java)
        writing().open(original.campaign, original.id).getOrNull() shouldBe original
        writing().replaceImage(original.campaign, original.id, SaveDraft(original.revision, original.fields, detailsImageAction = "replace"), "bad image".byteInputStream(), true).isLeft() shouldBe true
        writing().replaceImage(original.campaign, original.id, SaveDraft(original.revision - 1, original.fields, detailsImageAction = "replace"), ImageFixtures.png(320, 80).inputStream(), true).isLeft() shouldBe true
        writing().open(original.campaign, original.id).getOrNull() shouldBe original
        val exported = context!!.getBean(WritingExportService::class.java)
        val report = exported.inspect(original.campaign, original.id, InspectExport(original.revision, null)).getOrNull()!!
        report.warnings.any { it.contains("Markdown does not include the Details image") } shouldBe true
        val artifact = exported.create(original.campaign, original.id, CreateExport(original.revision, null, report.fingerprint, true)).getOrNull()!!
        val approval = context!!.getBean(SessionDrafts::class.java).retain(original.campaign, original.id, original.revision).getOrNull()!!
        approval.snapshot.detailsImage shouldBe original.detailsImage
        var session = preparation().create(original.campaign, CreateSession("Frozen", "")).getOrNull()!!
        session = preparation().addDraft(original.campaign, session.id, AddDraft(session.revision, original.id, original.revision)).getOrNull()!!
        val frozen = session.items.single()
        frozen.detailsImage shouldBe original.detailsImage
        val firstBytes = context!!.getBean(PreparedArtworkService::class.java).read(original.campaign, session.id, frozen.id, ImageVariant.DISPLAY, true).getOrNull()!!.content.sha256
        val changed = details(original, 400)
        val replaced = preparation().replaceDraft(original.campaign, session.id, frozen.id, AddDraft(session.revision, changed.id, changed.revision)).getOrNull()!!
        replaced.items.single().id shouldBe frozen.id
        replaced.items.single().detailsImage shouldBe changed.detailsImage
        writing().save(changed.campaign, changed.id, SaveDraft(changed.revision, changed.fields, detailsImageAction = "remove")).getOrNull()!!.image shouldBe original.image
        artwork.approved(original.campaign, original.id, original.revision, ImageVariant.DISPLAY, true).getOrNull()!!.content.sha256 shouldBe firstBytes
        artwork.exported(original.campaign, original.id, artifact.id, ImageVariant.DISPLAY, true).getOrNull()!!.content.sha256 shouldBe firstBytes
        artwork.draft(UUID.randomUUID(), original.id, ImageVariant.DISPLAY, true).isLeft() shouldBe true
        context!!.close(); context = start()
        context!!.getBean(ArtworkService::class.java).approved(original.campaign, original.id, original.revision, ImageVariant.DISPLAY, true).getOrNull()!!.content.sha256 shouldBe firstBytes
    }

    "CD4 both originals round trip through strict Writing and session ZIP recovery without changing Markdown hashes" {
        val d = details(front(fresh()))
        val portable = context!!.getBean(PortableWritingService::class.java)
        val recovery = context!!.getBean(RecoveryService::class.java)
        recovery.backup(d.campaign).isLeft() shouldBe true
        val bytes = portable.backup(d.campaign).getOrNull()!!.use { it.input().use { input -> input.readAllBytes() } }
        val recoveryCount = recovery.list().workspaces.size
        portable.restore(omitImage(bytes, d.detailsImage!!.hash).inputStream()).isLeft() shouldBe true
        recovery.list().workspaces.size shouldBe recoveryCount
        val workspace = portable.restore(bytes.inputStream()).getOrNull()!!
        val archive = recovery.workspace(workspace.id).getOrNull()!!
        archive.version shouldBe 12
        archive.drafts.single().detailsImage shouldBe d.detailsImage
        val copied = recovery.copy(workspace.id, CopyRecovery(d.id, d.campaign)).getOrNull()!!
        copied.detailsImage shouldBe d.detailsImage
        copied.image shouldBe d.image
        val mapper = context!!.getBean(ObjectMapper::class.java)
        val wrongVersion = mapper.valueToTree<ObjectNode>(archive).apply { put("version", 8) }
        val before = recovery.list().workspaces.size
        recovery.restore(mapper.writeValueAsBytes(wrongVersion)).isLeft() shouldBe true
        recovery.list().workspaces.size shouldBe before
        var session = preparation().create(d.campaign, CreateSession("Portable map", "")).getOrNull()!!
        session = preparation().addDraft(d.campaign, session.id, AddDraft(session.revision, d.id, d.revision)).getOrNull()!!
        preparation().export(d.campaign, ExportSessions(listOf(session.id))).isLeft() shouldBe true
        val sessions = context!!.getBean(PortableSessionService::class.java)
        val zip = sessions.export(d.campaign, ExportSessions(listOf(session.id))).getOrNull()!!.use { it.input().use { input -> input.readAllBytes() } }
        val count = preparation().list(d.campaign).getOrNull()!!.sessions.size
        sessions.import(d.campaign, omitImage(zip, d.detailsImage!!.hash).inputStream()).isLeft() shouldBe true
        preparation().list(d.campaign).getOrNull()!!.sessions.size shouldBe count
        val manifest = sessions.manifest(d.campaign, ExportSessions(listOf(session.id)), true).getOrNull()!!
        val badSessionVersion = mapper.valueToTree<ObjectNode>(manifest).apply { put("version", 12) }
        context!!.getBean(workbench.sessionarchives.application.SessionArchiveCodec::class.java).readTransfer(mapper.writeValueAsBytes(badSessionVersion)).isLeft() shouldBe true
        val imported = sessions.import(d.campaign, zip.inputStream()).getOrNull()!!.sessions.single()
        val restored = preparation().open(d.campaign, imported.id).getOrNull()!!.items.single()
        restored.detailsImage shouldBe d.detailsImage
        restored.image shouldBe d.image
        restored.markdown shouldBe session.items.single().markdown
        restored.provenance.contentHash shouldBe session.items.single().provenance.contentHash
        context!!.getBean(PreparedArtworkService::class.java).read(d.campaign, imported.id, restored.id, ImageVariant.DISPLAY, true).isRight() shouldBe true
    }

    "CD4 frozen Details image stays readable before reveal after source replacement removal and restart with access enforced" {
        val d = details(front(fresh()))
        var session = preparation().create(d.campaign, CreateSession("Shared map", "")).getOrNull()!!
        session = preparation().addDraft(d.campaign, session.id, AddDraft(session.revision, d.id, d.revision)).getOrNull()!!
        val item = session.items.single()
        val distribution = context!!.getBean(DistributionService::class.java)
        val preview = distribution.preview(d.campaign, PreviewSharedCard(session.id, item.id)).getOrNull()!!
        preview.detailsImage shouldBe true
        val req = DistributeCard(UUID.randomUUID(), session.id, item.id, preview.fingerprint, SharingMode.HANDOUT, null)
        val card = distribution.distribute(d.campaign, req).getOrNull()!!
        card.backRevealed shouldBe false
        card.detailsImage shouldBe true
        val sharing = context!!.getBean(SharingService::class.java)
        val player = sharing.add(d.campaign, AddCampaignPlayer("Map reader")).getOrNull()!!
        val invite = sharing.invite(d.campaign, player.id).getOrNull()!!
        val device = sharing.redeem(d.campaign, invite.token).getOrNull()!!
        val reader = context!!.getBean(PlayerCards::class.java)
        val content = reader.collections(d.campaign, device.credential).getOrNull()!!.group.cards.single()
        content.detailsImage shouldBe true
        content.visible.backText shouldBe ""
        val hash = reader.detailsImage(d.campaign, device.credential, card.id).getOrNull()!!.content.sha256
        (hash != reader.artwork(d.campaign, device.credential, card.id).getOrNull()!!.content.sha256) shouldBe true
        val changed = details(d, 440)
        session = preparation().replaceDraft(d.campaign, session.id, item.id, AddDraft(session.revision, changed.id, changed.revision)).getOrNull()!!
        distribution.previewArtwork(d.campaign, req, true).isLeft() shouldBe true
        distribution.distribute(d.campaign, req.copy(operation = UUID.randomUUID())).isLeft() shouldBe true
        preparation().save(d.campaign, session.id, SaveSession(session.revision, session.title, session.objective, session.notes, emptyList())).isRight() shouldBe true
        distribution.distribute(d.campaign, req).getOrNull()!!.id shouldBe card.id
        context!!.close(); context = start()
        val restarted = context!!.getBean(PlayerCards::class.java)
        restarted.detailsImage(d.campaign, device.credential, card.id).getOrNull()!!.content.sha256 shouldBe hash
        restarted.detailsImage(d.campaign, "bad", card.id).isLeft() shouldBe true
        context!!.getBean(SharingService::class.java).revoke(d.campaign, device.identity.device).isRight() shouldBe true
        restarted.detailsImage(d.campaign, device.credential, card.id).isLeft() shouldBe true
    }
})
