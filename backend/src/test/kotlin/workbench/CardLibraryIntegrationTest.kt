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
import tools.jackson.databind.node.ObjectNode
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.platform.api.*
import workbench.sources.api.SourceFilter
import workbench.sources.application.SourceService
import workbench.writing.api.*
import workbench.writing.application.*
import java.net.URI
import java.net.http.*
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class CardLibraryIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("card-library")
    var context: ConfigurableApplicationContext? = null
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    fun library() = context!!.getBean(CardLibraries::class.java)
    fun sources() = context!!.getBean(SourceService::class.java)
    fun writing() = context!!.getBean(WritingService::class.java)
    fun recovery() = context!!.getBean(RecoveryService::class.java)
    fun fresh(name: String): Pair<UUID, Path> {
        val path = Files.createDirectory(root.resolve(name))
        return context!!.getBean(CampaignService::class.java).register(RegisterCampaign(name, path.toString())).getOrNull()!!.id to path
    }
    fun raw(card: UUID, title: String = "Original", body: String = "# Source\nOriginal content") =
        "---\ncustom: keep\nworkbench:\n  schema: 1\n  id: $card\n  title: $title\n  type: npc\n  purpose: session\n  status: current\n  tags: [Harbour]\n---\n$body"
    fun capture(campaign: UUID) = sources().refresh(campaign).getOrNull()!!.capture!!
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively() }

    "Adventure choices use effective unified identities and whole Scene targets" {
        val (campaign, path) = fresh("adventure-choices")
        val sceneId = UUID.randomUUID()
        Files.writeString(path.resolve("scene.md"), raw(sceneId, "Source Scene", "# Scene\n## Encounter\nSource body").replace("type: npc", "type: scene"))
        Files.writeString(path.resolve("adventure.md"), raw(UUID.randomUUID(), "Adventure", "# Adventure\n[Scene](scene.md#encounter)\n[Again](scene.md#encounter)\n[Missing](missing.md)").replace("type: npc", "type: adventure"))
        val version = capture(campaign)
        val scene = library().editSource(campaign, EditLibrarySource(version, "scene.md")).getOrNull()!!
        writing().save(campaign, scene.id, SaveDraft(scene.revision, scene.fields.copy(title = "Effective Scene", body = "# Scene\n## Encounter\nEffective body"))).isRight() shouldBe true
        val adventure = library().list(campaign).getOrNull()!!.entries.single { it.title == "Adventure" }
        val choices = library().document(campaign, adventure.key, version, null).getOrNull()!!.adventureChoices
        choices.size shouldBe 2
        choices[0].entry!!.draft shouldBe scene.id
        choices[0].entry!!.title shouldBe "Effective Scene"
        choices[0].problem shouldBe null
        (choices[1].problem != null) shouldBe true
        // Associated Adventure Draft takes precedence over its Source links too.
        val draft = library().editSource(campaign, EditLibrarySource(version, "adventure.md")).getOrNull()!!
        val saved = writing().save(campaign, draft.id, SaveDraft(draft.revision, draft.fields.copy(body = "# Adventure\n[Bad heading](scene.md#removed)"))).getOrNull()!!
        val updated = library().list(campaign).getOrNull()!!.entries.single { it.draft == draft.id }
        val changed = library().document(campaign, updated.key, version, saved.revision, draft = draft.id).getOrNull()!!.adventureChoices
        changed.size shouldBe 1
        (changed.single().problem != null) shouldBe true
    }

    "associated editing preserves identity, Draft precedence, frozen reads and explicit refresh" {
        val (campaign, path) = fresh("precedence")
        val card = UUID.randomUUID()
        val original = raw(card, body = "# Source\nOriginalOnly <script>alert(1)</script> ![omit](x.png)")
        Files.writeString(path.resolve("original.md"), original)
        library().list(campaign).getOrNull()!!.entries shouldBe emptyList() // reads never scan
        val first = capture(campaign)
        val sourceEntry = library().list(campaign).getOrNull()!!.entries.single()
        sourceEntry.card shouldBe card
        sourceEntry.ready shouldBe true
        val read = library().document(campaign, sourceEntry.key, first, null).getOrNull()!!
        read.source!!.sections.flatMap { it.blocks }.any { "<script>" in it.html || "<img" in it.html } shouldBe false
        val d = library().editSource(campaign, EditLibrarySource(first, "original.md")).getOrNull()!!
        d.card shouldBe card
        d.origin!!.raw shouldBe original
        library().editSource(campaign, EditLibrarySource(first, "original.md")).getOrNull()!!.id shouldBe d.id
        val changed = writing().save(campaign, d.id, SaveDraft(0, d.fields.copy(title = "Draft title", body = "# Draft\nDraftOnly", tags = listOf("Custom"), summary = "Authored summary"))).getOrNull()!!
        val illustrated = writing().replaceImage(campaign, d.id, SaveDraft(changed.revision, changed.fields, "replace"), ImageFixtures.png(10, 8).inputStream()).getOrNull()!!
        val entry = library().list(campaign).getOrNull()!!.entries.single()
        entry.title shouldBe "Draft title"
        entry.image shouldBe illustrated.image
        entry.sources.single().state shouldBe "current"
        library().list(campaign, "OriginalOnly").getOrNull()!!.entries shouldBe emptyList()
        library().list(campaign, "DraftOnly", SourceFilter(types = setOf("npc"), tags = setOf("CUSTOM"))).getOrNull()!!.entries.single().draft shouldBe d.id
        library().document(campaign, entry.key, first, 0, draft = illustrated.id).leftOrNull()!!.code shouldBe "writing.stale-revision"
        library().document(campaign, entry.key, first, illustrated.revision, draft = illustrated.id).getOrNull()!!.markdown shouldBe illustrated.fields.body
        Files.writeString(path.resolve("original.md"), raw(card, "External edit"))
        library().list(campaign).getOrNull()!!.entries.single().sources.single().state shouldBe "current"
        val second = capture(campaign)
        library().list(campaign).getOrNull()!!.entries.single().sources.single().state shouldBe "changed"
        writing().open(campaign, d.id).getOrNull() shouldBe illustrated
        library().editSource(campaign, EditLibrarySource(first, "original.md")).leftOrNull()!!.code shouldBe "sources.capture-replaced"
        library().document(campaign, entry.key, first, illustrated.revision, draft = illustrated.id).leftOrNull()!!.code shouldBe "sources.capture-replaced"
        Files.move(path.resolve("original.md"), path.resolve("moved.md")); capture(campaign)
        library().list(campaign).getOrNull()!!.entries.single().sources.single().path shouldBe "moved.md"
        Files.writeString(path.resolve("original.md"), raw(UUID.randomUUID(), "A different card")); capture(campaign)
        library().list(campaign).getOrNull()!!.entries.size shouldBe 2
        library().list(campaign).getOrNull()!!.entries.all { it.conflicts.isEmpty() } shouldBe true
        Files.delete(path.resolve("original.md")); capture(campaign)
        Files.delete(path.resolve("moved.md")); capture(campaign)
        val absent = library().list(campaign).getOrNull()!!.entries.single()
        absent.sources.single().state shouldBe "unavailable"
        absent.ready shouldBe true
        Files.writeString(path.resolve("restored.md"), original); capture(campaign)
        library().list(campaign).getOrNull()!!.entries.single().sources.single().state shouldBe "current"
        (second != first) shouldBe true
    }

    "export recognition, deletion and recreation retain approval history with independent derivative copies" {
        val (campaign, path) = fresh("export")
        val d = writing().create(campaign, CreateDraft("scene", false)).getOrNull()!!
        val saved = writing().save(campaign, d.id, SaveDraft(0, d.fields.copy(title = "Scene", path = "scene.md", body = "# Scene"))).getOrNull()!!
        val exports = context!!.getBean(WritingExportService::class.java)
        val report = exports.inspect(campaign, d.id, InspectExport(1, null)).getOrNull()!!
        val artifact = exports.create(campaign, d.id, CreateExport(1, null, report.fingerprint, true)).getOrNull()!!
        Files.writeString(path.resolve("scene.md"), artifact.report.markdown)
        capture(campaign)
        val entry = library().list(campaign).getOrNull()!!.entries.single()
        entry.sources.single().state shouldBe "current"
        entry.draft shouldBe d.id
        context!!.getBean(SourceAssociationStore::class.java).list(campaign).single().card shouldBe d.card
        Files.delete(path.resolve("scene.md")); capture(campaign)
        library().list(campaign).getOrNull()!!.entries.single().sources.single().state shouldBe "unavailable"
        Files.writeString(path.resolve("scene.md"), artifact.report.markdown)
        val restoredCapture = capture(campaign)
        library().editSource(campaign, EditLibrarySource(restoredCapture, "scene.md")).getOrNull() shouldBe saved
        val approved = context!!.getBean(SessionDrafts::class.java).retain(campaign, d.id, 1).getOrNull()!!
        writing().delete(campaign, d.id, 1).isRight() shouldBe true
        library().list(campaign).getOrNull()!!.entries.single().draft shouldBe null
        val recreated = library().editSource(campaign, EditLibrarySource(restoredCapture, "scene.md")).getOrNull()!!
        recreated.card shouldBe d.card
        (recreated.id != d.id) shouldBe true
        context!!.getBean(ApprovedRevisionStore::class.java).get(campaign, d.id, 1) shouldBe approved
        val archive = context!!.getBean(RecoveryCodec::class.java).read(recovery().backup(campaign).getOrNull()!!)
        archive.approved.single().snapshot.id shouldBe d.id
        archive.drafts.single().id shouldBe recreated.id
        recovery().restore(context!!.getBean(RecoveryCodec::class.java).write(archive)).isRight() shouldBe true
        val fork = exports.fork(campaign, ForkDraft(restoredCapture, "scene.md")).getOrNull()!!
        (fork.card != d.card) shouldBe true
        library().list(campaign).getOrNull()!!.entries.size shouldBe 2
    }

    "legacy associations survive deletion and restart but do not guess moves or overwrite conflicting identities" {
        val (campaign, path) = fresh("legacy")
        Files.writeString(path.resolve("legacy.md"), "# Legacy\nNeeds metadata")
        var version = capture(campaign)
        library().list(campaign, filter = SourceFilter(unclassified = true)).getOrNull()!!.entries.single().ready shouldBe false
        val d = library().editSource(campaign, EditLibrarySource(version, "legacy.md")).getOrNull()!!
        d.fields.type shouldBe ""
        library().list(campaign).getOrNull()!!.entries.single().draft shouldBe d.id
        writing().delete(campaign, d.id, 0).isRight() shouldBe true
        context!!.close(); context = start()
        library().list(campaign).getOrNull()!!.entries.single().card shouldBe d.card
        val recreated = library().editSource(campaign, EditLibrarySource(version, "legacy.md")).getOrNull()!!
        recreated.card shouldBe d.card
        Files.move(path.resolve("legacy.md"), path.resolve("unknown-move.md")); version = capture(campaign)
        val entries = library().list(campaign).getOrNull()!!.entries
        entries.size shouldBe 2
        entries.single { it.draft == recreated.id }.sources.single().state shouldBe "unavailable"
        entries.single { it.draft == null }.card shouldBe null
        Files.writeString(path.resolve("legacy.md"), raw(UUID.randomUUID()))
        version = capture(campaign)
        library().list(campaign).getOrNull()!!.entries.count { it.conflicts.isNotEmpty() } shouldBe 2
        library().editSource(campaign, EditLibrarySource(version, "legacy.md")).leftOrNull()!!.code shouldBe "writing.identity-conflict"
        writing().list(campaign).getOrNull()!!.drafts.size shouldBe 1
    }

    "concurrent associated edits serialize, rollback is complete, collisions remain visible and campaigns isolate identity" {
        val (campaign, path) = fresh("concurrency")
        val card = UUID.randomUUID()
        Files.writeString(path.resolve("card.md"), raw(card))
        val version = capture(campaign)
        val tx = context!!.getBean(Transactions::class.java)
        tx.run<Unit> {
            library().editSource(campaign, EditLibrarySource(version, "card.md")).isRight() shouldBe true
            Either.Left(Failure.Invalid("test.rollback", "rollback"))
        }.isLeft() shouldBe true
        writing().list(campaign).getOrNull()!!.drafts shouldBe emptyList()
        context!!.getBean(SourceAssociationStore::class.java).list(campaign) shouldBe emptyList()
        val pool = Executors.newFixedThreadPool(4)
        val results = try {
            (1..4).map { pool.submit<DraftData> { library().editSource(campaign, EditLibrarySource(version, "card.md")).getOrNull()!! } }.map { it.get(15, TimeUnit.SECONDS) }
        } finally { pool.shutdownNow() }
        results.map { it.id }.distinct().size shouldBe 1
        val (other, otherPath) = fresh("other-campaign")
        Files.writeString(otherPath.resolve("card.md"), raw(card)); val otherVersion = capture(other)
        val otherDraft = library().editSource(other, EditLibrarySource(otherVersion, "card.md")).getOrNull()!!
        otherDraft.card shouldBe card
        (otherDraft.id != results.first().id) shouldBe true
        library().document(other, "card:$card", version, 0, draft = otherDraft.id).isLeft() shouldBe true
        Files.writeString(path.resolve("duplicate.md"), raw(card)); val collisionVersion = capture(campaign)
        val collision = library().list(campaign, filter = SourceFilter(issues = true)).getOrNull()!!.entries.single()
        collision.sources.size shouldBe 2
        collision.conflicts.isNotEmpty() shouldBe true
        collision.ready shouldBe false
        library().editSource(campaign, EditLibrarySource(collisionVersion, "duplicate.md")).isLeft() shouldBe true
        Files.writeString(path.resolve("unsafe.md"), "---\nworkbench: {schema: 99}\n---\nStill readable")
        val unsafeVersion = capture(campaign)
        val unsafe = library().list(campaign).getOrNull()!!.entries.single { it.sources.singleOrNull()?.path == "unsafe.md" }
        library().document(campaign, unsafe.key, unsafeVersion, null).isRight() shouldBe true
        library().editSource(campaign, EditLibrarySource(unsafeVersion, "unsafe.md")).isLeft() shouldBe true
        val (unclaimed, unclaimedPath) = fresh("source-collision")
        Files.writeString(unclaimedPath.resolve("a.md"), raw(card, "First claim"))
        Files.writeString(unclaimedPath.resolve("b.md"), raw(card, "Second claim"))
        val unclaimedVersion = capture(unclaimed)
        val conflicted = library().list(unclaimed).getOrNull()!!.entries.single()
        library().document(unclaimed, conflicted.key, unclaimedVersion, null).leftOrNull()!!.code shouldBe "writing.source-choice-required"
        library().document(unclaimed, conflicted.key, unclaimedVersion, null, "b.md").getOrNull()!!.source!!.path shouldBe "b.md"
        library().document(unclaimed, conflicted.key, unclaimedVersion, null, "outside.md").isLeft() shouldBe true
    }

    "conflict search includes every Source candidate independent of order and retains Draft precedence" {
        val (campaign, path) = fresh("conflict-search")
        val card = UUID.randomUUID()
        Files.writeString(path.resolve("a.md"), raw(card, "Primary title", "# Primary heading\nPrimaryNeedle"))
        Files.writeString(path.resolve("b.md"), raw(card, "Secondary title", "# Secondary heading\nSecondaryNeedle")
            .replace("tags: [Harbour]", "tags: [SecondaryTag]\n  summary: SecondarySummary"))
        var version = capture(campaign)
        val key = library().list(campaign).getOrNull()!!.entries.single().key
        val queries = listOf("PrimaryNeedle", "SecondaryNeedle", "a.md", "b.md", "Secondary title", "SecondaryTag", "SecondarySummary", "Secondary heading")
        for (query in queries) library().list(campaign, query).getOrNull()!!.entries.map { it.key } shouldBe listOf(key)
        library().list(campaign, "AbsentNeedle").getOrNull()!!.entries shouldBe emptyList()
        val conflict = library().list(campaign, "SecondaryNeedle").getOrNull()!!.entries.single()
        conflict.sources.map { it.path } shouldBe listOf("a.md", "b.md")
        conflict.ready shouldBe false
        conflict.conflicts.isNotEmpty() shouldBe true
        library().document(campaign, key, version, null).leftOrNull()!!.code shouldBe "writing.source-choice-required"
        library().document(campaign, key, version, null, "b.md").getOrNull()!!.source!!.path shouldBe "b.md"
        writing().list(campaign).getOrNull()!!.drafts shouldBe emptyList()

        Files.move(path.resolve("a.md"), path.resolve("z.md")); version = capture(campaign)
        for (query in queries.filter { it != "a.md" } + "z.md") {
            library().list(campaign, query).getOrNull()!!.entries.map { it.key } shouldBe listOf(key)
        }
        library().list(campaign).getOrNull()!!.entries.single().sources.map { it.path } shouldBe listOf("b.md", "z.md")
        library().list(campaign, "a.md").getOrNull()!!.entries shouldBe emptyList()
        library().document(campaign, key, version, null).leftOrNull()!!.code shouldBe "writing.source-choice-required"

        Files.delete(path.resolve("z.md")); version = capture(campaign)
        val draft = library().editSource(campaign, EditLibrarySource(version, "b.md")).getOrNull()!!
        writing().save(campaign, draft.id, SaveDraft(0, draft.fields.copy(title = "Effective Draft", tags = emptyList(), summary = "", body = "# Effective\nEffectiveDraftNeedle"))).isRight() shouldBe true
        for (query in listOf("SecondaryNeedle", "Secondary title", "SecondaryTag", "SecondarySummary", "Secondary heading")) {
            library().list(campaign, query).getOrNull()!!.entries shouldBe emptyList()
        }
        library().list(campaign, "EffectiveDraftNeedle").getOrNull()!!.entries.single().draft shouldBe draft.id
    }

    "association archives round trip strictly and recovery copying never rebinds live Sources" {
        val (campaign, path) = fresh("archive")
        Files.writeString(path.resolve("legacy.md"), "# Untyped\nBody")
        val version = capture(campaign)
        val d = library().editSource(campaign, EditLibrarySource(version, "legacy.md")).getOrNull()!!
        val associations = context!!.getBean(SourceAssociationStore::class.java)
        val codec = context!!.getBean(RecoveryCodec::class.java)
        val bytes = recovery().backup(campaign).getOrNull()!!
        val archive = codec.read(bytes)
        archive.version shouldBe 5
        archive.associations shouldBe associations.list(campaign)
        val workspace = recovery().restore(bytes).getOrNull()!!
        codec.read(recovery().archive(workspace.id).getOrNull()!!) shouldBe archive
        val portable = context!!.getBean(PortableWritingService::class.java)
        val zip = portable.backup(campaign).getOrNull()!!.use { download -> download.input().use { it.readAllBytes() } }
        val imported = portable.restore(zip.inputStream()).getOrNull()!!
        recovery().workspace(imported.id).getOrNull()!!.associations shouldBe archive.associations
        recovery().workspace(imported.id).getOrNull()!!.version shouldBe 6
        val reexport = portable.archive(imported.id).getOrNull()!!.use { download -> download.input().use { it.readAllBytes() } }
        portable.restore(reexport.inputStream()).isRight() shouldBe true
        val before = associations.list(campaign)
        val copied = recovery().copy(workspace.id, CopyRecovery(d.id, campaign)).getOrNull()!!
        (copied.card != d.card) shouldBe true
        associations.list(campaign) shouldBe before
        library().list(campaign).getOrNull()!!.entries.size shouldBe 2
        val mapper = context!!.getBean(ObjectMapper::class.java)
        val count = recovery().list().workspaces.size
        fun bad(mutate: (ObjectNode) -> Unit) {
            val tree = mapper.readTree(bytes) as ObjectNode; mutate(tree)
            recovery().restore(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
            recovery().list().workspaces.size shouldBe count
        }
        bad { it.remove("associations") }
        bad { it.put("version", 1) }
        bad { it.withArray("associations").add(it.path("associations")[0]) }
        bad { (it.path("associations")[0] as ObjectNode).put("hash", "tampered") }
        bad { (it.path("associations")[0] as ObjectNode).put("path", "../unsafe.md") }
        bad { (it.path("associations")[0] as ObjectNode).put("declaredId", UUID.randomUUID().toString()) }
        val many = archive.copy(associations = List(10001) { archive.associations.single().copy(card = UUID.randomUUID()) })
        recovery().restore(codec.write(many)).isLeft() shouldBe true
        context!!.close(); context = start()
        recovery().workspace(workspace.id).getOrNull()!!.associations shouldBe before
    }

    "HTTP detail reads bind revisions to Draft identity across deletion and recreation" {
        val (campaign, path) = fresh("revision-identity")
        Files.writeString(path.resolve("card.md"), raw(UUID.randomUUID()))
        val version = capture(campaign)
        val key = library().list(campaign).getOrNull()!!.entries.single().key
        val port = (context as WebServerApplicationContext).webServer!!.port
        val client = HttpClient.newHttpClient()
        fun read(draft: UUID? = null, revision: Long? = null, cardKey: String = key, captured: UUID = version): HttpResponse<String> {
            val query = "key=$cardKey&capture=$captured" + (draft?.let { "&draft=$it" } ?: "") + (revision?.let { "&revision=$it" } ?: "")
            return client.send(HttpRequest.newBuilder(URI("http://127.0.0.1:$port/api/campaigns/$campaign/cards/document?$query")).GET().build(), HttpResponse.BodyHandlers.ofString())
        }
        read().statusCode() shouldBe 200
        val original = library().editSource(campaign, EditLibrarySource(version, "card.md")).getOrNull()!!
        val old = writing().save(campaign, original.id, SaveDraft(0, original.fields.copy(body = "# Old selected revision\nOldDraftNeedle"))).getOrNull()!!
        read(old.id, old.revision).statusCode() shouldBe 200
        writing().delete(campaign, old.id, old.revision).isRight() shouldBe true
        val recreated = library().editSource(campaign, EditLibrarySource(version, "card.md")).getOrNull()!!
        val replacement = writing().save(campaign, recreated.id, SaveDraft(0, recreated.fields.copy(body = "# Replacement\nReplacementNeedle"))).getOrNull()!!
        replacement.card shouldBe old.card
        (replacement.id != old.id) shouldBe true
        replacement.revision shouldBe old.revision
        read(old.id, old.revision).statusCode() shouldBe 409
        val current = read(replacement.id, replacement.revision)
        current.statusCode() shouldBe 200
        val document = context!!.getBean(ObjectMapper::class.java).readValue(current.body(), LibraryDocument::class.java)
        document.draft!!.id shouldBe replacement.id
        document.markdown shouldBe replacement.fields.body
        read(revision = replacement.revision).statusCode() shouldBe 409
        read(replacement.id).statusCode() shouldBe 409
        read(UUID.randomUUID(), replacement.revision).statusCode() shouldBe 409
        read(replacement.id, replacement.revision - 1).statusCode() shouldBe 409
        read().statusCode() shouldBe 409 // a stale Source-only selection cannot silently become a Draft read
        writing().delete(campaign, replacement.id, replacement.revision).isRight() shouldBe true
        read(replacement.id, replacement.revision).statusCode() shouldBe 409
        read().statusCode() shouldBe 200
        val standalone = writing().create(campaign, CreateDraft("npc", false)).getOrNull()!!
        read(standalone.id, standalone.revision, "card:${standalone.card}").statusCode() shouldBe 200
        read(revision = standalone.revision, cardKey = "card:${standalone.card}").statusCode() shouldBe 409
        capture(campaign)
        read(standalone.id, standalone.revision, "card:${standalone.card}").statusCode() shouldBe 409
    }

    "HTTP contracts expose unified reads, filters, associated editing and stale capture errors" {
        val (campaign, path) = fresh("http")
        Files.writeString(path.resolve("one.md"), raw(UUID.randomUUID()))
        val version = capture(campaign)
        val port = (context as WebServerApplicationContext).webServer!!.port
        val client = HttpClient.newHttpClient()
        val mapper = context!!.getBean(ObjectMapper::class.java)
        fun request(suffix: String, payload: Any? = null): HttpResponse<String> {
            val builder = HttpRequest.newBuilder(URI("http://127.0.0.1:$port/api/campaigns/$campaign/cards$suffix"))
            if (payload == null) builder.GET() else builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofByteArray(mapper.writeValueAsBytes(payload)))
            return client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
        }
        val response = request("?query=Original&types=npc&tags=HARBOUR")
        response.statusCode() shouldBe 200
        mapper.readValue(response.body(), CardLibrary::class.java).entries.size shouldBe 1
        request("/edit-source", EditLibrarySource(version, "one.md")).statusCode() shouldBe 200
        val entry = library().list(campaign).getOrNull()!!.entries.single()
        request("/document?key=${entry.key}&capture=$version&draft=${entry.draft}&revision=0").statusCode() shouldBe 200
        val draft = writing().open(campaign, entry.draft!!).getOrNull()!!
        val linked = writing().save(campaign, draft.id, SaveDraft(0, draft.fields.copy(body = "# Heading\n[local](#heading) [external](https://example.com) [unsafe](javascript:alert)"))).getOrNull()!!
        library().document(campaign, entry.key, version, linked.revision, draft = linked.id).getOrNull()!!.draftPreview!!.checkedLinks.map { it.kind } shouldBe listOf("local", "external", "unsupported")
        request("/edit-source", mapOf("path" to "one.md")).statusCode() shouldBe 400
        request("/edit-source", mapOf("capture" to version, "path" to "x".repeat(65537))).statusCode() shouldBe 400
        capture(campaign)
        request("/edit-source", EditLibrarySource(version, "one.md")).statusCode() shouldBe 409
        val schema = client.send(HttpRequest.newBuilder(URI("http://127.0.0.1:$port/v3/api-docs")).GET().build(), HttpResponse.BodyHandlers.ofString())
        schema.statusCode() shouldBe 200
        schema.body().contains("listLibraryCards") shouldBe true
    }
})
