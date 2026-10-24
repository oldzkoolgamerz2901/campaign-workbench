package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import workbench.campaigns.api.*
import workbench.campaigns.application.CampaignService
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.*
import workbench.preparation.domain.Session
import workbench.playthroughs.api.*
import workbench.sessionarchives.application.PortableSessionService
import workbench.sources.api.*
import workbench.sources.application.SourceService
import workbench.writing.api.*
import workbench.writing.application.WritingService
import java.net.URI
import java.net.http.*
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class SessionLibraryIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("session-library")
    var context: ConfigurableApplicationContext? = null
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    fun prep() = context!!.getBean(PreparationService::class.java)
    fun service() = context!!.getBean(SessionLibraryService::class.java)
    fun library() = context!!.getBean(CardLibraries::class.java)
    fun sources() = context!!.getBean(SourceService::class.java)
    fun writing() = context!!.getBean(WritingService::class.java)
    fun play() = context!!.getBean(Playthroughs::class.java)
    fun jdbc() = context!!.getBean(JdbcTemplate::class.java)
    fun fresh(name: String): Pair<UUID, Path> {
        val path = Files.createDirectory(root.resolve(name))
        return context!!.getBean(CampaignService::class.java).register(RegisterCampaign(name, path.toString())).getOrNull()!!.id to path
    }
    fun raw(card: UUID, title: String = "Original", type: String = "npc", body: String = "# Source\nOriginal body") =
        "---\nworkbench:\n  schema: 1\n  id: $card\n  title: $title\n  type: $type\n  purpose: session\n  status: current\n  tags: [Harbour]\n---\n$body"
    fun request(campaign: UUID, s: SessionData, key: String = library().list(campaign).getOrNull()!!.entries.single().key): AddLibraryCard {
        val catalogue = library().list(campaign).getOrNull()!!
        val entry = catalogue.entries.single { it.key == key }
        return AddLibraryCard(s.revision, key, catalogue.capture, entry.draft, entry.revision)
    }
    fun counts(campaign: UUID) = listOf("writing.draft", "writing.source_association", "writing.approved_revision", "preparation.item").map { table ->
        if (table == "preparation.item") jdbc().queryForObject("SELECT count(*) FROM preparation.item i JOIN preparation.session s ON s.id=i.session_id WHERE s.campaign=?", Long::class.java, campaign)
        else jdbc().queryForObject("SELECT count(*) FROM $table WHERE campaign=?", Long::class.java, campaign)
    }
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively() }

    "concurrent whole-card Add retries create one Draft and item, reuse across sessions and retain explicit duplicate choices" {
        val (campaign, path) = fresh("concurrent")
        val card = UUID.randomUUID()
        Files.writeString(path.resolve("card.md"), raw(card))
        sources().refresh(campaign).isRight() shouldBe true
        val session = prep().create(campaign, CreateSession("One", "")).getOrNull()!!
        val command = request(campaign, session)
        service().list(campaign, session.id, "body", SourceFilter(types = setOf("npc"), tags = setOf("HARBOUR"))).getOrNull()!!.entries.single().state shouldBe SessionCardState.READY
        val pool = Executors.newFixedThreadPool(4)
        val results = try { (1..4).map { pool.submit<LibraryAddResult> { service().add(campaign, session.id, command).getOrNull()!! } }.map { it.get(30, TimeUnit.SECONDS) } } finally { pool.shutdownNow() }
        results.count { it.added } shouldBe 1
        results.map { it.items.single() }.distinct().size shouldBe 1
        counts(campaign) shouldBe listOf(1L, 1L, 1L, 1L)
        val frozen = prep().open(campaign, session.id).getOrNull()!!
        frozen.revision shouldBe 1
        frozen.items.single().provenance.authored!!.card shouldBe card
        service().list(campaign, session.id).getOrNull()!!.entries.single().state shouldBe SessionCardState.ALREADY_PREPARED
        val second = prep().create(campaign, CreateSession("Two", "")).getOrNull()!!
        val added = service().add(campaign, second.id, request(campaign, second)).getOrNull()!!
        added.session.items.single().provenance.authored!!.draft shouldBe frozen.items.single().provenance.authored!!.draft
        counts(campaign) shouldBe listOf(1L, 1L, 1L, 2L)
        val draft = writing().open(campaign, library().list(campaign).getOrNull()!!.entries.single().draft!!).getOrNull()!!
        val duplicate = prep().addDraft(campaign, session.id, AddDraft(frozen.revision, draft.id, draft.revision)).getOrNull()!!
        val before = counts(campaign)
        val retry = service().add(campaign, session.id, command).getOrNull()!!
        retry.added shouldBe false
        retry.session shouldBe duplicate
        retry.items shouldBe duplicate.items.map { it.id }
        service().list(campaign, session.id).getOrNull()!!.entries.single().matches.map { it.item } shouldBe retry.items
        counts(campaign) shouldBe before
        Files.readString(path.resolve("card.md")) shouldBe raw(card)
    }

    "section captures do not satisfy whole-card membership and foreign imported identity never binds to a local card" {
        val (campaign, path) = fresh("sections")
        val card = UUID.randomUUID()
        Files.writeString(path.resolve("card.md"), raw(card))
        val capture = sources().refresh(campaign).getOrNull()!!.capture!!
        val section = sources().document(campaign, capture, "card.md").getOrNull()!!.sections.last().id
        var session = prep().create(campaign, CreateSession("Sections", "")).getOrNull()!!
        session = prep().addHistoricalSource(context!!, campaign, session.id, HistoricalSource(session.revision, capture, "card.md", section)).getOrNull()!!
        service().list(campaign, session.id).getOrNull()!!.entries.single().matches shouldBe emptyList()
        val added = service().add(campaign, session.id, request(campaign, session)).getOrNull()!!
        added.added shouldBe true
        added.session.items.size shouldBe 2
        service().replace(campaign, session.id, session.items.single().id, request(campaign, added.session)).isLeft() shouldBe true
        val (other, otherPath) = fresh("foreign")
        Files.writeString(otherPath.resolve("card.md"), raw(card, "Independent campaign")); sources().refresh(other).isRight() shouldBe true
        val archive = prep().export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!
        val imported = prep().import(other, archive).getOrNull()!!.sessions.single().id
        val restored = prep().open(other, imported).getOrNull()!!
        service().list(other, imported).getOrNull()!!.entries.single().matches shouldBe emptyList()
        service().replace(other, imported, restored.items.last().id, request(other, restored)).isLeft() shouldBe true
        service().add(other, imported, request(other, restored)).getOrNull()!!.session.items.size shouldBe 3
        // Historical full Source captures do satisfy membership without automatic conversion.
        var legacy = prep().create(campaign, CreateSession("Legacy whole", "")).getOrNull()!!
        legacy = prep().addHistoricalSource(context!!, campaign, legacy.id, HistoricalSource(0, capture, "card.md", null)).getOrNull()!!
        val noOp = service().add(campaign, legacy.id, request(campaign, legacy)).getOrNull()!!
        noOp.added shouldBe false
        noOp.session shouldBe legacy
        val updated = service().replace(campaign, legacy.id, legacy.items.single().id, request(campaign, legacy)).getOrNull()!!
        updated.items.single().id shouldBe legacy.items.single().id
        updated.items.single().provenance.kind shouldBe "authored"
    }

    "incomplete, conflicting and stale additions reject without any partial writes" {
        val (campaign, path) = fresh("reject")
        Files.writeString(path.resolve("legacy.md"), "# Untyped\nEditable later")
        sources().refresh(campaign).isRight() shouldBe true
        val session = prep().create(campaign, CreateSession("Rejected", "")).getOrNull()!!
        val incomplete = request(campaign, session)
        service().add(campaign, session.id, incomplete).isLeft() shouldBe true
        counts(campaign) shouldBe listOf(0L, 0L, 0L, 0L)
        val card = UUID.randomUUID()
        Files.writeString(path.resolve("legacy.md"), raw(card))
        sources().refresh(campaign).isRight() shouldBe true
        val sourceCommand = request(campaign, session)
        service().add(campaign, session.id, incomplete).leftOrNull()!!.code shouldBe "sources.capture-replaced"
        service().add(campaign, session.id, sourceCommand.copy(revision = 99)).leftOrNull()!!.code shouldBe "preparation.stale-revision"
        counts(campaign) shouldBe listOf(0L, 0L, 0L, 0L)
        val draft = library().editSource(campaign, EditLibrarySource(sourceCommand.capture!!, "legacy.md")).getOrNull()!!
        service().add(campaign, session.id, sourceCommand).leftOrNull()!!.code shouldBe "writing.stale-revision"
        val saved = writing().save(campaign, draft.id, SaveDraft(draft.revision, draft.fields.copy(title = "Saved"))).getOrNull()!!
        service().add(campaign, session.id, sourceCommand.copy(draft = draft.id, draftRevision = draft.revision)).leftOrNull()!!.code shouldBe "writing.stale-revision"
        val expected = request(campaign, session)
        writing().delete(campaign, saved.id, saved.revision).isRight() shouldBe true
        val replacement = library().editSource(campaign, EditLibrarySource(sourceCommand.capture, "legacy.md")).getOrNull()!!
        val equalRevision = writing().save(campaign, replacement.id, SaveDraft(replacement.revision, replacement.fields.copy(title = "Replacement"))).getOrNull()!!
        equalRevision.revision shouldBe saved.revision
        service().add(campaign, session.id, expected).leftOrNull()!!.code shouldBe "writing.stale-revision"
        Files.writeString(path.resolve("duplicate.md"), raw(card)); sources().refresh(campaign).isRight() shouldBe true
        val conflict = request(campaign, session)
        val before = counts(campaign)
        service().add(campaign, session.id, conflict).leftOrNull()!!.code shouldBe "writing.identity-conflict"
        service().list(campaign, session.id).getOrNull()!!.entries.single().state shouldBe SessionCardState.BLOCKED
        counts(campaign) shouldBe before
        val (other, _) = fresh("isolated")
        service().add(other, session.id, conflict).leftOrNull()!!.code shouldBe "preparation.not-found"
        service().list(other, session.id).isLeft() shouldBe true
        prep().open(campaign, session.id).getOrNull() shouldBe session
    }

    "late persistence failure rolls back automatic Draft, association, approval and prepared membership together" {
        val (campaign, path) = fresh("rollback")
        Files.writeString(path.resolve("card.md"), raw(UUID.randomUUID())); sources().refresh(campaign).isRight() shouldBe true
        val session = prep().create(campaign, CreateSession("Rollback", "")).getOrNull()!!
        val c = context!!
        val store = c.getBean(SessionStore::class.java)
        val failing = object : SessionStore by store {
            override fun put(session: Session) { store.put(session); error("simulated failure after item insert") }
        }
        val campaigns = c.getBean(Campaigns::class.java)
        val tx = c.getBean(Transactions::class.java)
        val brokenPrep = PreparationService(campaigns, failing, tx,
            c.getBean(PreparationMarkdown::class.java), c.getBean(SessionDrafts::class.java), c.getBean(PreparationImageStore::class.java))
        val broken = SessionLibraryService(campaigns, library(), brokenPrep, tx)
        runCatching { broken.add(campaign, session.id, request(campaign, session)) }.isFailure shouldBe true
        counts(campaign) shouldBe listOf(0L, 0L, 0L, 0L)
        prep().open(campaign, session.id).getOrNull() shouldBe session
        val added = service().add(campaign, session.id, request(campaign, session)).getOrNull()!!
        added.added shouldBe true
        val draft = writing().open(campaign, added.session.items.single().provenance.authored!!.draft).getOrNull()!!
        writing().replaceImage(campaign, draft.id, SaveDraft(draft.revision, draft.fields.copy(body = "# New\nIllustrated update"), "replace"), ImageFixtures.png(11, 8).inputStream()).isRight() shouldBe true
        val before = counts(campaign)
        val imageCount = jdbc().queryForObject("SELECT count(*) FROM preparation.image_original WHERE owner_id=?", Long::class.java, campaign)
        runCatching { broken.replace(campaign, session.id, added.items.single(), request(campaign, added.session)) }.isFailure shouldBe true
        counts(campaign) shouldBe before
        jdbc().queryForObject("SELECT count(*) FROM preparation.image_original WHERE owner_id=?", Long::class.java, campaign) shouldBe imageCount
        prep().open(campaign, session.id).getOrNull() shouldBe added.session
    }

    "explicit replacement freezes exact text and artwork while retaining notes, item order and all Play state, with portable restart round trip" {
        val (campaign, path) = fresh("replace")
        Files.writeString(path.resolve("scene.md"), raw(UUID.randomUUID(), "Scene", "scene"))
        sources().refresh(campaign).isRight() shouldBe true
        val session = prep().create(campaign, CreateSession("Replace", "Objective")).getOrNull()!!
        var frozen = service().add(campaign, session.id, request(campaign, session)).getOrNull()!!.session
        val first = frozen.items.single()
        val d = writing().open(campaign, first.provenance.authored!!.draft).getOrNull()!!
        frozen = prep().addDraft(campaign, session.id, AddDraft(frozen.revision, d.id, d.revision)).getOrNull()!!
        frozen = prep().save(campaign, session.id, SaveSession(frozen.revision, frozen.title, frozen.objective, "Session notes", frozen.items.map { ItemNotes(it.id, "Keep ${it.id}") })).getOrNull()!!
        frozen = prep().association(campaign, session.id, first.id, frozen.items.last().id, ChangeSceneAssociation(frozen.revision, true)).getOrNull()!!
        val old = frozen
        val initial = play().open(campaign, session.id).getOrNull()!!
        val workspace = play().save(campaign, session.id, SaveWorkspace(initial.revision, listOf(frozen.items.last().id), listOf(first.id), first.id, listOf(first.id))).getOrNull()!!
        val edited = writing().save(campaign, d.id, SaveDraft(d.revision, d.fields.copy(title = "New scene", body = "# New\nSafe <script>evil</script>"))).getOrNull()!!
        val illustrated = writing().replaceImage(campaign, d.id, SaveDraft(edited.revision, edited.fields, "replace"), ImageFixtures.png(13, 9).inputStream()).getOrNull()!!
        prep().open(campaign, session.id).getOrNull() shouldBe old
        val status = service().list(campaign, session.id).getOrNull()!!.entries.single()
        status.state shouldBe SessionCardState.UPDATE_AVAILABLE
        status.matches.all { it.canUpdate } shouldBe true
        val command = request(campaign, frozen)
        service().replace(campaign, session.id, first.id, command.copy(draft = UUID.randomUUID())).leftOrNull()!!.code shouldBe "writing.stale-revision"
        service().replace(campaign, session.id, first.id, command.copy(revision = frozen.revision - 1)).leftOrNull()!!.code shouldBe "preparation.stale-revision"
        val replaced = service().replace(campaign, session.id, first.id, command).getOrNull()!!
        replaced.items.map { it.id } shouldBe old.items.map { it.id }
        replaced.items.map { it.notes } shouldBe old.items.map { it.notes }
        replaced.sceneLinks shouldBe old.sceneLinks
        replaced.notes shouldBe old.notes
        replaced.objective shouldBe old.objective
        replaced.items.last() shouldBe old.items.last()
        replaced.items.first().provenance.authored!!.revision shouldBe illustrated.revision
        replaced.items.first().image shouldBe illustrated.image
        play().open(campaign, session.id).getOrNull() shouldBe workspace
        prep().view(campaign, session.id).getOrNull()!!.items.first().source.html.contains("<script>") shouldBe false
        service().replace(campaign, session.id, first.id, request(campaign, replaced)).getOrNull() shouldBe replaced
        val archiveService = context!!.getBean(PortableSessionService::class.java)
        val zip = archiveService.export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!.use { it.input().use { source -> source.readBytes() } }
        val imported = archiveService.import(campaign, zip.inputStream()).getOrNull()!!.sessions.single().id
        val restored = prep().open(campaign, imported).getOrNull()!!
        restored.items.first().provenance shouldBe replaced.items.first().provenance
        restored.items.first().image shouldBe replaced.items.first().image
        restored.items.map { it.notes } shouldBe replaced.items.map { it.notes }
        restored.sceneLinks shouldBe listOf(SceneAssociation(restored.items.first().id, restored.items.last().id))
        val restoredPlay = play().open(campaign, imported).getOrNull()!!
        restoredPlay.used shouldBe listOf(restored.items.first().id)
        restoredPlay.activeSceneItemId shouldBe restored.items.first().id
        restoredPlay.focusedItemIds shouldBe listOf(restored.items.first().id)
        val differentType = writing().save(campaign, d.id, SaveDraft(illustrated.revision, illustrated.fields.copy(type = "npc"))).getOrNull()!!
        differentType.fields.type shouldBe "npc"
        service().list(campaign, session.id).getOrNull()!!.entries.single().matches.all { !it.canUpdate } shouldBe true
        service().replace(campaign, session.id, first.id, request(campaign, replaced)).isLeft() shouldBe true
        prep().open(campaign, session.id).getOrNull() shouldBe replaced
        play().open(campaign, session.id).getOrNull() shouldBe workspace
        context!!.close(); context = start()
        prep().open(campaign, session.id).getOrNull() shouldBe replaced
        prep().open(campaign, imported).getOrNull() shouldBe restored
        play().open(campaign, session.id).getOrNull() shouldBe workspace
    }

    "replacement rebuilds outgoing bindings while old incoming links never substitute the newer prepared revision" {
        val (campaign, _) = fresh("links")
        val target = writing().create(campaign, CreateDraft("npc", false)).getOrNull()!!
        val b = writing().save(campaign, target.id, SaveDraft(0, target.fields.copy(title = "B", path = "b.md", body = "# B\nOld target"))).getOrNull()!!
        val origin = writing().create(campaign, CreateDraft("scene", false)).getOrNull()!!
        val a = writing().save(campaign, origin.id, SaveDraft(0, origin.fields.copy(title = "A", path = "a.md", body = "# A\n[B](b.md#b)"))).getOrNull()!!
        var s = prep().create(campaign, CreateSession("Links", "")).getOrNull()!!
        s = service().add(campaign, s.id, request(campaign, s, "card:${b.card}")).getOrNull()!!.session
        s = service().add(campaign, s.id, request(campaign, s, "card:${a.card}")).getOrNull()!!.session
        val bItem = s.items.first().id
        val aItem = s.items.last().id
        prep().view(campaign, s.id).getOrNull()!!.items.last().source.links.single().target shouldBe "@$bItem#b"
        val b2 = writing().save(campaign, b.id, SaveDraft(b.revision, b.fields.copy(body = "# B\nNew target\n[A](a.md#a)"))).getOrNull()!!
        s = service().replace(campaign, s.id, bItem, request(campaign, s, "card:${b.card}")).getOrNull()!!
        val view = prep().view(campaign, s.id).getOrNull()!!
        view.items.last().source.links.single().unavailable shouldBe true
        view.items.first().source.links.single().target shouldBe "@$aItem#a"
        s.items.first().provenance.authored!!.revision shouldBe b2.revision
        val manifest = context!!.getBean(PortableSessionService::class.java).manifest(campaign, ExportSessions(listOf(s.id))).getOrNull()!!
        manifest.version shouldBe 8
        manifest.workspaces.single().workspace shouldBe null
        val archiveService = context!!.getBean(PortableSessionService::class.java)
        val imported = archiveService.restore(campaign, manifest).getOrNull()!!.sessions.single().id
        prep().view(campaign, imported).getOrNull()!!.items.last().source.links.single().unavailable shouldBe true
    }

    "HTTP contracts expose destination status, bounded commands, explicit replacement and actionable errors" {
        val (campaign, path) = fresh("http")
        Files.writeString(path.resolve("card.md"), raw(UUID.randomUUID())); sources().refresh(campaign).isRight() shouldBe true
        val s = prep().create(campaign, CreateSession("HTTP", "")).getOrNull()!!
        val port = (context as WebServerApplicationContext).webServer!!.port
        val mapper = context!!.getBean(ObjectMapper::class.java)
        val client = HttpClient.newHttpClient()
        fun http(suffix: String = "", method: String = "GET", payload: Any? = null): HttpResponse<String> {
            val builder = HttpRequest.newBuilder(URI("http://127.0.0.1:$port/api/campaigns/$campaign/sessions/${s.id}/library$suffix"))
                .header("Content-Type", "application/json")
            builder.method(method, payload?.let { HttpRequest.BodyPublishers.ofByteArray(mapper.writeValueAsBytes(it)) } ?: HttpRequest.BodyPublishers.noBody())
            return client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
        }
        http("?query=Original&types=npc&tags=HARBOUR").statusCode() shouldBe 200
        val command = request(campaign, s)
        val added = http(method = "POST", payload = command)
        added.statusCode() shouldBe 200
        val result = mapper.readValue(added.body(), LibraryAddResult::class.java)
        result.added shouldBe true
        http(method = "POST", payload = command).statusCode() shouldBe 200
        val draft = writing().open(campaign, result.session.items.single().provenance.authored!!.draft).getOrNull()!!
        writing().save(campaign, draft.id, SaveDraft(draft.revision, draft.fields.copy(title = "New"))).isRight() shouldBe true
        http("/${result.items.single()}", "PUT", request(campaign, result.session)).statusCode() shouldBe 200
        http("/${result.items.single()}", "PUT", command).statusCode() shouldBe 409
        http(method = "POST", payload = mapOf("key" to command.key)).statusCode() shouldBe 400
        http(method = "POST", payload = mapOf("key" to "x".repeat(65537))).statusCode() shouldBe 400
        http(method = "POST", payload = command.copy(capture = UUID.randomUUID())).statusCode() shouldBe 409
        val schema = client.send(HttpRequest.newBuilder(URI("http://127.0.0.1:$port/v3/api-docs")).GET().build(), HttpResponse.BodyHandlers.ofString())
        listOf("listSessionLibraryCards", "addSessionLibraryCard", "replacePreparedLibraryCard").all { it in schema.body() } shouldBe true
    }
})
