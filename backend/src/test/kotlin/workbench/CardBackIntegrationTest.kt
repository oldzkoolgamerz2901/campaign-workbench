package workbench

import arrow.core.Either
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
import workbench.sessionarchives.adapter.web.SessionArchiveReader
import workbench.sources.api.Authoring
import workbench.sources.api.AuthoredDocument
import workbench.writing.api.*
import workbench.writing.application.*
import workbench.writing.domain.Draft
import java.nio.file.Files
import java.util.UUID

class CardBackIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("card-back")
    var context: ConfigurableApplicationContext? = null
    beforeSpec { database.start(); context = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}") }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively() }

    "stateless layout HTTP contract uses supplied historical text without campaign state" {
        val c = context!!
        val port = (c as org.springframework.boot.web.server.context.WebServerApplicationContext).webServer!!.port
        val mapper = c.getBean(ObjectMapper::class.java)
        val client = java.net.http.HttpClient.newHttpClient()
        fun calculate(body: String): java.net.http.HttpResponse<String> = client.send(
            java.net.http.HttpRequest.newBuilder(java.net.URI("http://127.0.0.1:$port/api/card-layout"))
                .header("Content-Type", "application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(body)).build(),
            java.net.http.HttpResponse.BodyHandlers.ofString())
        val input = workbench.sources.api.CardLayoutInput("Historical Mira", "npc", "Keeper", listOf("harbour"), "Secret\nSecond line")
        val response = calculate(mapper.writeValueAsString(input))
        response.statusCode() shouldBe 200
        mapper.readValue(response.body(), workbench.sources.api.CardLayout::class.java) shouldBe
            c.getBean(workbench.sources.api.CardLayoutCalculator::class.java).layout(input)
        val oversized = calculate(mapper.writeValueAsString(input.copy(backText = "line\n".repeat(40))))
        oversized.statusCode() shouldBe 200
        mapper.readTree(oversized.body()).path("back").path("fits").asBoolean() shouldBe false
        calculate("{broken").statusCode() shouldBe 400
    }

    "separate back survives freeze replacement archives and recovery while fit gates remain atomic" {
        val c = context!!
        val campaign = c.getBean(CampaignService::class.java).register(RegisterCampaign("Back text", root.toString())).getOrNull()!!.id
        val writing = c.getBean(WritingService::class.java)
        val preparation = c.getBean(PreparationService::class.java)
        val created = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        val back = "Motivation\nProtect the harbour.\n\n<script>plain text</script>"
        var d = writing.save(campaign, created.id, SaveDraft(0, created.fields.copy(title = "Mira", summary = "Harbour keeper.", backText = back))).getOrNull()!!
        val preview = writing.preview(campaign, d.id, d.fields).getOrNull()!!
        preview.layout!!.back.fits shouldBe true
        preview.preview.classification.metadata!!.backText shouldBe back
        var first = preparation.create(campaign, CreateSession("First", "")).getOrNull()!!
        first = preparation.addDraft(campaign, first.id, AddDraft(first.revision, d.id, d.revision)).getOrNull()!!
        var second = preparation.create(campaign, CreateSession("Second", "")).getOrNull()!!
        second = preparation.addDraft(campaign, second.id, AddDraft(second.revision, d.id, d.revision)).getOrNull()!!
        first.items.single().capturedSource!!.classification.metadata!!.backText shouldBe back
        d = writing.save(campaign, d.id, SaveDraft(d.revision, d.fields.copy(backText = "Too much text\n".repeat(40)))).getOrNull()!!
        writing.preview(campaign, d.id, d.fields).getOrNull()!!.layout!!.back.fits shouldBe false
        preparation.replaceDraft(campaign, first.id, first.items.single().id, AddDraft(first.revision, d.id, d.revision)).leftOrNull()!!.code shouldBe "writing.card-does-not-fit"
        preparation.open(campaign, first.id).getOrNull() shouldBe first
        val exports = c.getBean(WritingExportService::class.java)
        val inspection = exports.inspect(campaign, d.id, InspectExport(d.revision, null)).getOrNull()!!
        inspection.errors shouldBe emptyList()
        exports.create(campaign, d.id, CreateExport(d.revision, null, inspection.fingerprint, true)).isRight() shouldBe true
        d = writing.save(campaign, d.id, SaveDraft(d.revision, d.fields.copy(backText = "A revised secret."))).getOrNull()!!
        val itemId = first.items.single().id
        first = preparation.replaceDraft(campaign, first.id, itemId, AddDraft(first.revision, d.id, d.revision)).getOrNull()!!
        first.items.single().id shouldBe itemId
        first.items.single().capturedSource!!.classification.metadata!!.backText shouldBe "A revised secret."
        preparation.open(campaign, second.id).getOrNull() shouldBe second
        val codec = c.getBean(SessionArchiveReader::class.java)
        val archive = preparation.export(campaign, ExportSessions(listOf(first.id, second.id))).getOrNull()!!
        archive.version shouldBe 11
        codec.read(codec.write(archive)).getOrNull() shouldBe archive
        val imported = preparation.import(campaign, archive).getOrNull()!!
        preparation.open(campaign, imported.sessions.first().id).getOrNull()!!.items.single().capturedSource!!.classification.metadata!!.backText shouldBe "A revised secret."
        val recovery = c.getBean(RecoveryService::class.java)
        val bytes = recovery.backup(campaign).getOrNull()!!
        val restored = recovery.restore(bytes).getOrNull()!!
        recovery.detail(restored.id, "draft:${d.id}").getOrNull()!!.snapshot.fields.backText shouldBe "A revised secret."
        val copy = recovery.copy(restored.id, CopyRecovery(d.id, campaign)).getOrNull()!!
        copy.fields.backText shouldBe "A revised secret."
        writing.open(campaign, copy.id).getOrNull() shouldBe copy
    }

    "literal predecessor recovery and formerly unknown back metadata retain their hashes and interpretation" {
        val c = context!!
        val authoring = c.getBean(Authoring::class.java)
        val card = UUID.randomUUID()
        val raw = "---\nworkbench:\n  schema: 1\n  id: $card\n  title: Old\n  type: npc\n  purpose: session\n  status: current\n  backText: {legacy: true}\n---\n# Old body\n"
        val old = authoring.decode(raw, 1)
        old.errors shouldBe emptyList()
        old.retainedEnvelope.contains("backText") shouldBe true
        authoring.decode(raw, 2).errors.isNotEmpty() shouldBe true
        val encoded = authoring.encode(AuthoredDocument(card, "Old", "npc", "current", emptyList(), "", old.body, interpretation = 1), old.retainedEnvelope)
        encoded.errors shouldBe emptyList()
        authoring.encode(AuthoredDocument(card, "Old", "npc", "current", emptyList(), "", old.body), old.retainedEnvelope).errors.isNotEmpty() shouldBe true
        val campaign = UUID.randomUUID(); val draft = UUID.randomUUID()
        // Literal old shape: no backText field and no encoding discriminator on the snapshot.
        val mapper = c.getBean(ObjectMapper::class.java)
        val literal = """{"format":"workbench-writing-recovery","version":3,"campaign":"$campaign","name":"Old literal","savedAt":"2026-10-24T00:00:00Z","drafts":[{"id":"$draft","campaign":"$campaign","card":"$card","revision":0,"fields":{"title":"Old","type":"npc","status":"current","tags":[],"summary":"","body":"# Old body\\n","path":"old.md"},"origin":null,"recovery":null}],"approved":[],"exports":[],"associations":[]}"""
        val recovery = c.getBean(RecoveryService::class.java)
        val restored = recovery.restore(literal.toByteArray()).getOrNull()!!
        val detail = recovery.detail(restored.id, "draft:$draft").getOrNull()!!
        detail.snapshot.encoding shouldBe 1
        detail.snapshot.fields.backText shouldBe ""
        mapper.readTree(recovery.archive(restored.id).getOrNull()!!).path("version").intValue() shouldBe 5
        val historical = mapper.readTree(literal) as ObjectNode
        val oldSnapshot = historical.path("drafts")[0] as ObjectNode
        (oldSnapshot.path("fields") as ObjectNode).put("body", old.body)
        oldSnapshot.set("origin", mapper.valueToTree(mapOf("campaign" to campaign, "capture" to UUID.randomUUID(), "path" to "old.md", "card" to card,
            "raw" to raw, "hash" to contentHash(raw), "retainedEnvelope" to old.retainedEnvelope, "issues" to old.issues, "interpretation" to 1)))
        historical.withArray("approved").add(mapper.valueToTree<ObjectNode>(mapOf("snapshot" to oldSnapshot.deepCopy(), "markdown" to encoded.markdown,
            "hash" to contentHash(encoded.markdown), "links" to emptyList<Any>())).putNull("capture"))
        val legacyExportId = UUID.randomUUID()
        val report = mapper.createObjectNode().put("revision", 0).put("path", "old.md").put("markdown", encoded.markdown).put("hash", contentHash(encoded.markdown)).put("fingerprint", "a".repeat(64)).putNull("capture")
        report.putArray("errors"); report.putArray("warnings"); report.putArray("links"); report.putObject("targetRevisions")
        val exported = mapper.createObjectNode().put("id", legacyExportId.toString()).put("createdAt", "2026-10-24T00:00:00Z").put("acknowledged", false)
        exported.set("snapshot", oldSnapshot.deepCopy()); exported.set("report", report)
        historical.withArray("exports").add(exported)
        val legacyDecoded = c.getBean(RecoveryCodec::class.java).read(mapper.writeValueAsBytes(historical))
        RecoveryValidation(authoring).validate(legacyDecoded)
        val preserved = recovery.restore(mapper.writeValueAsBytes(historical)).getOrNull()!!
        val evidence = recovery.detail(preserved.id, "approved:$draft:0").getOrNull()!!
        evidence.markdown shouldBe encoded.markdown
        evidence.hash shouldBe contentHash(encoded.markdown)
        recovery.detail(preserved.id, "export:$legacyExportId").getOrNull()!!.hash shouldBe evidence.hash
        val reimported = recovery.restore(recovery.archive(preserved.id).getOrNull()!!).getOrNull()!!
        recovery.detail(reimported.id, "approved:$draft:0").getOrNull()!!.hash shouldBe evidence.hash
        historical.put("version", 4)
        RecoveryValidation(authoring).validate(c.getBean(RecoveryCodec::class.java).readIllustrated(mapper.writeValueAsBytes(historical)))
        val bad = mapper.readTree(literal) as ObjectNode
        (bad.path("drafts")[0].path("fields") as ObjectNode).put("backText", "must not be accepted as old")
        recovery.restore(mapper.writeValueAsBytes(bad)).isLeft() shouldBe true
    }

    "literal v10 sessions remain readable and new Source exports preserve authored back text" {
        val c = context!!
        val campaign = c.getBean(CampaignService::class.java).register(RegisterCampaign("Legacy session", Files.createTempDirectory(root, "session").toString())).getOrNull()!!.id
        val session = UUID.randomUUID(); val item = UUID.randomUUID(); val capture = UUID.randomUUID()
        val markdown = "# Old body"
        val hash = contentHash(markdown)
        val literal = """{"version":10,"sessions":[{"id":"$session","campaign":"$campaign","revision":0,"title":"Old session","objective":"","notes":"","sceneLinks":[],"items":[{"id":"$item","title":"Old body","markdown":"# Old body","notes":"","anchors":{},"capturedSource":null,"provenance":{"campaign":"$campaign","capture":"$capture","path":"old.md","section":null,"documentHash":"$hash","contentHash":"$hash","kind":"source","authored":null}}]}]}"""
        val codec = c.getBean(SessionArchiveReader::class.java)
        val archive = codec.read(literal.toByteArray()).getOrNull()!!
        archive.version shouldBe 10
        val prep = c.getBean(PreparationService::class.java)
        val imported = prep.import(campaign, archive).getOrNull()!!.sessions.single()
        prep.open(campaign, imported.id).getOrNull()!!.items.single().markdown shouldBe markdown
        val authoring = c.getBean(Authoring::class.java)
        val back = "A motive.\n\nA secret.\n<script>plain</script>\n"
        authoring.decode("---\nworkbench:\n  backText: null\n---\nBody").errors.isNotEmpty() shouldBe true
        val encoded = authoring.encode(AuthoredDocument(UUID.randomUUID(), "Mira", "npc", "current", emptyList(), "Keeper.", "# Body", back))
        authoring.decode(encoded.markdown).backText shouldBe back
        val path = Files.createTempDirectory(root, "source")
        Files.writeString(path.resolve("mira.md"), encoded.markdown)
        val sourceCampaign = c.getBean(CampaignService::class.java).register(RegisterCampaign("Back Source", path.toString())).getOrNull()!!.id
        val version = c.getBean(workbench.sources.application.SourceService::class.java).refresh(sourceCampaign).getOrNull()!!.capture!!
        val draft = c.getBean(CardLibraries::class.java).editSource(sourceCampaign, EditLibrarySource(version, "mira.md")).getOrNull()!!
        draft.fields.backText shouldBe back
        draft.origin!!.interpretation shouldBe 2
    }

    "retained approval is not an exemption from the new fit gate" {
        val c = context!!
        val campaign = c.getBean(CampaignService::class.java).register(RegisterCampaign("Legacy approval", Files.createTempDirectory(root, "legacy").toString())).getOrNull()!!.id
        val d = Draft(UUID.randomUUID(), campaign, UUID.randomUUID(), 1, "Old", "npc", "current", emptyList(), "summary ".repeat(80), "# Body", "old.md")
        val authoring = c.getBean(Authoring::class.java)
        val encoded = authoring.encode(AuthoredDocument(d.card, d.title, d.type, d.status, d.tags, d.summary, d.body, interpretation = 1))
        val snapshot = draftData(d)
        c.getBean(DraftStore::class.java).put(d)
        c.getBean(ApprovedRevisionStore::class.java).put(ApprovedDraft(snapshot, encoded.markdown, contentHash(encoded.markdown), encoded.preview, null, emptyList()))
        c.getBean(SessionDrafts::class.java).retain(campaign, d.id, d.revision).leftOrNull()!!.code shouldBe "writing.card-does-not-fit"
        c.getBean(ApprovedRevisionStore::class.java).get(campaign, d.id, d.revision)!!.snapshot shouldBe snapshot
    }
})
