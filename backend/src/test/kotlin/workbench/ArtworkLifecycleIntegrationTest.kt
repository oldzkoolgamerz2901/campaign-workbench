package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.*
import workbench.sessionarchives.application.*
import workbench.sources.application.SourceService
import workbench.writing.api.*
import workbench.writing.application.*
import java.io.ByteArrayOutputStream
import java.net.URI
import java.net.http.*
import java.nio.file.Files
import java.util.UUID
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import java.util.zip.ZipEntry

class ArtworkLifecycleIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("artwork-lifecycle")
    val otherRoot = Files.createTempDirectory("artwork-other")
    var context: ConfigurableApplicationContext? = null
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    fun mapper() = context!!.getBean(ObjectMapper::class.java)
    fun writing() = context!!.getBean(WritingService::class.java)
    fun prep() = context!!.getBean(PreparationService::class.java)
    fun jdbc() = context!!.getBean(JdbcTemplate::class.java)
    fun base() = "http://127.0.0.1:${(context as WebServerApplicationContext).webServer!!.port}"
    val http = HttpClient.newHttpClient()
    fun request(path: String, method: String = "GET", bytes: ByteArray? = null, content: String = "application/json", etag: String? = null): HttpResponse<ByteArray> {
        val builder = HttpRequest.newBuilder(URI.create(base() + path)).header("Content-Type", content)
        if (etag != null) builder.header("If-None-Match", etag)
        builder.method(method, bytes?.let(HttpRequest.BodyPublishers::ofByteArray) ?: HttpRequest.BodyPublishers.noBody())
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray())
    }
    fun multipart(campaign: UUID, draft: DraftData, image: ByteArray, command: SaveDraft = SaveDraft(draft.revision, draft.fields, "replace"), duplicate: Boolean = false, metadataJson: ByteArray? = null): HttpResponse<ByteArray> {
        val out = ByteArrayOutputStream()
        fun part(name: String, data: ByteArray) {
            out.write("--boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n".toByteArray()); out.write(data); out.write("\r\n".toByteArray())
        }
        part("metadata", metadataJson ?: mapper().writeValueAsBytes(command)); part("image", image)
        if (duplicate) part("image", image)
        out.write("--boundary--\r\n".toByteArray())
        return request("/api/campaigns/$campaign/drafts/${draft.id}/artwork", "POST", out.toByteArray(), "multipart/form-data; boundary=boundary")
    }
    fun newDraft(campaign: UUID, title: String): DraftData {
        val d = writing().create(campaign, CreateDraft("npc", false)).getOrNull()!!
        return writing().save(campaign, d.id, SaveDraft(d.revision, d.fields.copy(title = title, summary = "A portrait", body = "# $title\nExact body"))).getOrNull()!!
    }
    fun replace(campaign: UUID, draft: DraftData, width: Int): DraftData = writing().replaceImage(campaign, draft.id, SaveDraft(draft.revision, draft.fields, "replace"), ImageFixtures.png(width, 7).inputStream()).getOrNull()!!
    fun bytes(download: PortableDownload): ByteArray = download.use { it.input().use { source -> source.readBytes() } }
    fun entries(zip: ByteArray): Map<String, ByteArray> {
        val result = linkedMapOf<String, ByteArray>()
        ZipInputStream(zip.inputStream()).use { input -> while (true) { val entry = input.nextEntry ?: break; result[entry.name] = input.readBytes() } }
        return result
    }
    fun zip(entries: Map<String, ByteArray>): ByteArray = ByteArrayOutputStream().also { out -> ZipOutputStream(out).use { z -> entries.forEach { (name, data) -> z.putNextEntry(ZipEntry(name)); z.write(data); z.closeEntry() } } }.toByteArray()
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively(); otherRoot.toFile().deleteRecursively() }

    "HTTP replacement is revision-atomic, validates actual input and serves scoped conditional derivatives" {
        val campaign = context!!.getBean(CampaignService::class.java).register(RegisterCampaign("Artwork", root.toString())).getOrNull()!!.id
        val other = context!!.getBean(CampaignService::class.java).register(RegisterCampaign("Other", otherRoot.toString())).getOrNull()!!.id
        val d = newDraft(campaign, "First")
        val savedResponse = multipart(campaign, d, ImageFixtures.webp("transparent"), SaveDraft(d.revision, d.fields.copy(body = "# Saved together"), "replace"))
        savedResponse.statusCode() shouldBe 200
        val saved = mapper().readValue(savedResponse.body(), DraftData::class.java)
        saved.revision shouldBe d.revision + 1
        saved.fields.body shouldBe "# Saved together"
        saved.image!!.mime shouldBe "image/webp"
        val path = "/api/campaigns/$campaign/drafts/${d.id}/artwork/DISPLAY"
        val read = request(path)
        read.statusCode() shouldBe 200
        read.headers().firstValue("Content-Type").get() shouldBe "image/png"
        read.headers().firstValue("X-Content-Type-Options").get() shouldBe "nosniff"
        request(path, etag = read.headers().firstValue("ETag").get()).statusCode() shouldBe 304
        request(path.replace(campaign.toString(), other.toString())).statusCode() shouldBe 404
        request(path.replace("DISPLAY", "ORIGINAL")).statusCode() shouldBe 400
        multipart(campaign, d, ImageFixtures.png(11, 7)).statusCode() shouldBe 409
        multipart(campaign, saved, "bad image".toByteArray(), SaveDraft(saved.revision, saved.fields.copy(body = "Must not save"), "replace")).statusCode() shouldBe 400
        multipart(campaign, saved, ImageFixtures.png(11, 7), duplicate = true).statusCode() shouldBe 400
        multipart(campaign, saved, ByteArray(ImageLimits.ORIGINAL_BYTES + 1)).statusCode() shouldBe 400
        val malformed = mapper().valueToTree<tools.jackson.databind.node.ObjectNode>(SaveDraft(saved.revision, saved.fields, "replace"))
        malformed.remove("revision")
        multipart(campaign, saved, ImageFixtures.png(11, 7), metadataJson = mapper().writeValueAsBytes(malformed)).statusCode() shouldBe 400
        malformed.put("revision", saved.revision)
        (malformed.path("fields") as tools.jackson.databind.node.ObjectNode).put("title", 123)
        multipart(campaign, saved, ImageFixtures.png(11, 7), metadataJson = mapper().writeValueAsBytes(malformed)).statusCode() shouldBe 400
        writing().open(campaign, d.id).getOrNull() shouldBe saved
        val owner = WritingImageOwner.Campaign(campaign)
        val store = context!!.getBean(WritingImageStore::class.java)
        val missingHash = context!!.getBean(ImageProcessor::class.java).process(ImageFixtures.png(11, 7).inputStream()).getOrNull()!!.metadata.hash
        store.metadata(owner, missingHash) shouldBe null
        val kept = writing().save(campaign, d.id, SaveDraft(saved.revision, saved.fields.copy(summary = "Keep artwork"))).getOrNull()!!
        kept.image shouldBe saved.image
        writing().save(campaign, d.id, SaveDraft(kept.revision, kept.fields, "replace")).isLeft() shouldBe true
        context!!.getBean(Transactions::class.java).run<Unit> {
            writing().save(campaign, d.id, SaveDraft(kept.revision, kept.fields, "remove")).isRight() shouldBe true
            Either.Left(Failure.Invalid("test.rollback", "rollback"))
        }.isLeft() shouldBe true
        writing().open(campaign, d.id).getOrNull()!!.image shouldBe saved.image
        store.metadata(owner, saved.image.hash) shouldBe saved.image
        val removed = writing().save(campaign, d.id, SaveDraft(kept.revision, kept.fields, "remove")).getOrNull()!!
        removed.image shouldBe null
        store.metadata(owner, saved.image.hash) shouldBe null
        request(path).statusCode() shouldBe 404
        writing().delete(campaign, d.id, removed.revision).isRight() shouldBe true
        multipart(campaign, removed, ImageFixtures.png(11, 7)).statusCode() shouldBe 404
        store.metadata(owner, missingHash) shouldBe null
    }

    "approval, orphan history, portable archives and detached copies retain original artwork independently" {
        val campaigns = context!!.getBean(CampaignService::class.java).list().getOrNull()!!.campaigns
        val campaign = campaigns.single { it.name == "Artwork" }.id
        val other = campaigns.single { it.name == "Other" }.id
        val capture = context!!.getBean(SourceService::class.java).refresh(campaign).getOrNull()!!.capture
        val d = replace(campaign, newDraft(campaign, "Frozen"), 21)
        val first = d.image!!
        val exports = context!!.getBean(WritingExportService::class.java)
        val report = exports.inspect(campaign, d.id, InspectExport(d.revision, capture)).getOrNull()!!
        val artifact = exports.create(campaign, d.id, CreateExport(d.revision, capture, report.fingerprint, true)).getOrNull()!!
        var session = prep().create(campaign, CreateSession("Illustrated session", "")).getOrNull()!!
        session = prep().addDraft(campaign, session.id, AddDraft(session.revision, d.id, d.revision)).getOrNull()!!
        session.items.single().image shouldBe first
        val second = replace(campaign, d, 22)
        prep().open(campaign, session.id).getOrNull()!!.items.single().image shouldBe first
        prep().export(campaign, ExportSessions(listOf(session.id))).isLeft() shouldBe true
        context!!.getBean(RecoveryService::class.java).backup(campaign).isLeft() shouldBe true
        val portable = context!!.getBean(PortableWritingService::class.java)
        val writingZip = bytes(portable.backup(campaign).getOrNull()!!)
        entries(writingZip).keys.filter { it.startsWith("images/") }.toSet() shouldBe setOf("images/${first.hash}", "images/${second.image!!.hash}")
        val play = context!!.getBean(workbench.playthroughs.api.Playthroughs::class.java)
        val workspace = play.open(campaign, session.id).getOrNull()!!
        play.move(campaign, session.id, workbench.playthroughs.api.MoveCard(workspace.revision, session.items.single().id, workbench.playthroughs.api.CardLocation.USED)).isRight() shouldBe true
        val sessionZip = bytes(context!!.getBean(PortableSessionService::class.java).export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!)
        entries(sessionZip).keys.toSet() shouldBe setOf("manifest.json", "images/${first.hash}")
        writing().delete(campaign, d.id, second.revision).isRight() shouldBe true
        request("/api/campaigns/$campaign/drafts/${d.id}/approved/${d.revision}/artwork/DISPLAY").statusCode() shouldBe 200
        request("/api/campaigns/$campaign/drafts/${d.id}/exports/${artifact.id}/artwork/DISPLAY").statusCode() shouldBe 200
        request("/api/campaigns/$campaign/sessions/${session.id}/items/${session.items.single().id}/artwork/THUMBNAIL").statusCode() shouldBe 200
        context!!.getBean(WritingImageStore::class.java).metadata(WritingImageOwner.Campaign(campaign), first.hash) shouldBe first
        context!!.getBean(WritingImageStore::class.java).metadata(WritingImageOwner.Campaign(campaign), second.image.hash) shouldBe null
        val restored = portable.restore(writingZip.inputStream()).getOrNull()!!
        val recovery = context!!.getBean(RecoveryService::class.java)
        recovery.detail(restored.id, "draft:${d.id}").getOrNull()!!.snapshot.image shouldBe second.image
        request("/api/writing-recovery/${restored.id}/artwork/DISPLAY?key=draft:${d.id}").statusCode() shouldBe 200
        val copied = recovery.copy(restored.id, CopyRecovery(d.id, other)).getOrNull()!!
        copied.image shouldBe second.image
        (copied.id != d.id && copied.card != d.card) shouldBe true
        context!!.getBean(WritingImageStore::class.java).metadata(WritingImageOwner.Campaign(other), second.image.hash) shouldBe second.image
        val imported = context!!.getBean(PortableSessionService::class.java).import(other, sessionZip.inputStream()).getOrNull()!!
        var importedSession = prep().open(other, imported.sessions.single().id).getOrNull()!!
        importedSession.items.single().image shouldBe first
        play.open(other, importedSession.id).getOrNull()!!.used shouldBe listOf(importedSession.items.single().id)
        play.open(other, importedSession.id).getOrNull()!!.sessionCards shouldBe emptyList()
        (importedSession.items.single().id != session.items.single().id) shouldBe true
        context!!.close(); context = start()
        request("/api/campaigns/$other/sessions/${importedSession.id}/items/${importedSession.items.single().id}/artwork/DISPLAY").statusCode() shouldBe 200
        bytes(context!!.getBean(PortableWritingService::class.java).archive(restored.id).getOrNull()!!).isNotEmpty() shouldBe true
        importedSession = prep().save(other, importedSession.id, SaveSession(importedSession.revision, importedSession.title, importedSession.objective, importedSession.notes, emptyList())).getOrNull()!!
        importedSession.items.size shouldBe 0
        context!!.getBean(PreparationImageStore::class.java).metadata(other, first.hash) shouldBe null
        context!!.getBean(PreparationImageStore::class.java).metadata(campaign, first.hash) shouldBe first
        val download = request("/api/writing-recovery/${restored.id}/portable-archive")
        download.statusCode() shouldBe 200
        entries(download.body()).containsKey("manifest.json") shouldBe true
    }

    "malformed ZIP membership, image data and manifests fail before any import writes and release transfer storage" {
        val campaigns = context!!.getBean(CampaignService::class.java).list().getOrNull()!!.campaigns
        val campaign = campaigns.single { it.name == "Artwork" }.id
        val other = campaigns.single { it.name == "Other" }.id
        val session = prep().list(campaign).getOrNull()!!.sessions.single()
        val service = context!!.getBean(PortableSessionService::class.java)
        val valid = bytes(service.export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!)
        val e = entries(valid); val image = e.keys.single { it.startsWith("images/") }
        val before = prep().list(other).getOrNull()!!.sessions.size
        val malformed = listOf(
            zip(e - image), zip(e + ("images/${"0".repeat(64)}" to ImageFixtures.png(2, 2))),
            zip(e + (image to ImageFixtures.png(3, 3))), zip(e + ("../outside" to byteArrayOf(1))),
            zip(e + ("manifest.json" to "{}".toByteArray())), valid.copyOf(valid.size - 10))
        malformed.forEach { archive -> service.import(other, archive.inputStream()).isLeft() shouldBe true }
        prep().list(other).getOrNull()!!.sessions.size shouldBe before
        context!!.getBean(PortableTransfers::class.java).open().getOrNull()!!.close()
        val response = request("/api/campaigns/$other/sessions/portable-import", "POST", valid, "application/octet-stream")
        response.statusCode() shouldBe 200
        val downloaded = request("/api/campaigns/$campaign/sessions/portable-export", "POST", mapper().writeValueAsBytes(ExportSessions(listOf(session.id))))
        downloaded.statusCode() shouldBe 200
        entries(downloaded.body()).keys shouldBe e.keys
    }

    "image-aware persistence failures roll back records and staged image rows in both archive owners" {
        val c = context!!
        val campaign = c.getBean(CampaignService::class.java).list().getOrNull()!!.campaigns.single { it.name == "Artwork" }.id
        val session = prep().list(campaign).getOrNull()!!.sessions.single()
        val transfer = c.getBean(PortableTransfers::class.java)
        val tx = c.getBean(Transactions::class.java)
        val processor = c.getBean(ImageProcessor::class.java)
        val targetRoot = Files.createDirectory(root.resolve("failed-import"))
        val target = c.getBean(CampaignService::class.java).register(RegisterCampaign("Failed import", targetRoot.toString())).getOrNull()!!.id
        val sessionZip = bytes(c.getBean(PortableSessionService::class.java).export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!)
        val store = c.getBean(SessionStore::class.java)
        val failing = object : SessionStore by store {
            override fun put(session: workbench.preparation.domain.Session) { store.put(session); error("simulated session persistence failure") }
        }
        val images = c.getBean(PreparationImageStore::class.java)
        val campaigns = c.getBean(workbench.campaigns.api.Campaigns::class.java)
        val brokenPreparation = PreparationService(campaigns, failing, tx,
            c.getBean(PreparationMarkdown::class.java), c.getBean(SessionDrafts::class.java), images)
        val brokenSessions = PortableSessionService(PreparationTransferFacade(brokenPreparation, images), c.getBean(workbench.playthroughs.api.WorkspaceTransfers::class.java), transfer, c.getBean(SessionArchiveCodec::class.java), processor, tx, campaigns)
        brokenSessions.import(target, sessionZip.inputStream()).isLeft() shouldBe true
        prep().list(target).getOrNull()!!.sessions.size shouldBe 0
        jdbc().queryForObject("SELECT count(*) FROM preparation.image_original WHERE owner_id=?", Long::class.java, target) shouldBe 0L

        val recovery = c.getBean(RecoveryService::class.java)
        val writingZip = bytes(c.getBean(PortableWritingService::class.java).backup(campaign).getOrNull()!!)
        val writingImages = c.getBean(WritingImageStore::class.java)
        val failingImages = object : WritingImageStore by writingImages {
            override fun put(owner: WritingImageOwner, image: ProcessedImage) { writingImages.put(owner, image); error("simulated image persistence failure") }
        }
        val before = recovery.list().workspaces.size
        val imageCount = jdbc().queryForObject("SELECT count(*) FROM writing.image_original WHERE owner_kind='recovery'", Long::class.java)
        val brokenWriting = PortableWritingService(recovery, failingImages, transfer, c.getBean(RecoveryCodec::class.java), processor, tx)
        brokenWriting.restore(writingZip.inputStream()).isLeft() shouldBe true
        recovery.list().workspaces.size shouldBe before
        jdbc().queryForObject("SELECT count(*) FROM writing.image_original WHERE owner_kind='recovery'", Long::class.java) shouldBe imageCount
        transfer.open().getOrNull()!!.close()
    }
})
