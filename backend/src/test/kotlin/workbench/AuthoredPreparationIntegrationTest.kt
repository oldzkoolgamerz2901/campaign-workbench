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
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.PreparationService
import workbench.preparation.adapter.web.SessionArchiveReader
import workbench.sources.application.SourceService
import workbench.writing.api.*
import workbench.writing.application.*
import java.nio.file.Files

class AuthoredPreparationIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("authored-session")
    val otherRoot = Files.createTempDirectory("authored-import")
    var context: ConfigurableApplicationContext? = null
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively(); otherRoot.toFile().deleteRecursively() }
    "approval is exact, atomic, frozen, campaign scoped and portable without live draft or source records" {
        val campaigns = context!!.getBean(CampaignService::class.java)
        val campaign = campaigns.register(RegisterCampaign("Authoring", root.toString())).getOrNull()!!.id
        val other = campaigns.register(RegisterCampaign("Recovered session", otherRoot.toString())).getOrNull()!!.id
        val writing = context!!.getBean(WritingService::class.java)
        val prep = context!!.getBean(PreparationService::class.java)
        val sources = context!!.getBean(SourceService::class.java)
        Files.writeString(root.resolve("scene.md"), "# Scene\nOriginal scene")
        val capture = sources.refresh(campaign).getOrNull()!!.capture!!
        fun draft(title: String, path: String, body: String): DraftData {
            val d = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
            return writing.save(campaign, d.id, SaveDraft(d.revision, d.fields.copy(title = title, summary = "Authored summary", tags = listOf("Reef"), path = path, body = body))).getOrNull()!!
        }
        val target = draft("Target", "target.md", "# Same\n# Same\nExact target")
        val origin = draft("Origin", "origin.md", "# Origin\r\n[local](#origin) [draft](target.md#same-1) [source](scene.md#scene) [missing](missing.md) [bad](javascript:alert(1))\r\n<script>unsafe</script> ![image](image.png)")
        var session = prep.create(campaign, CreateSession("Mixed session", "")).getOrNull()!!
        prep.addDraft(other, session.id, AddDraft(0, origin.id, origin.revision)).isLeft() shouldBe true
        val foreign = prep.create(other, CreateSession("Other", "")).getOrNull()!!
        prep.addDraft(other, foreign.id, AddDraft(0, origin.id, origin.revision)).isLeft() shouldBe true
        prep.addDraft(campaign, session.id, AddDraft(0, origin.id, 0)).leftOrNull()!!.code shouldBe "writing.stale-revision"
        val incomplete = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        prep.addDraft(campaign, session.id, AddDraft(0, incomplete.id, incomplete.revision)).isLeft() shouldBe true
        val revisions = context!!.getBean(ApprovedRevisionStore::class.java)
        val tx = context!!.getBean(Transactions::class.java)
        tx.run<Unit> {
            prep.addDraft(campaign, session.id, AddDraft(0, origin.id, origin.revision)).isRight() shouldBe true
            Either.Left(Failure.Invalid("test.rollback", "Simulate later capture failure"))
        }.isLeft() shouldBe true
        revisions.get(campaign, origin.id, origin.revision) shouldBe null
        prep.open(campaign, session.id).getOrNull() shouldBe session
        session = prep.add(campaign, session.id, AddSource(session.revision, capture, "scene.md", null)).getOrNull()!!
        session = prep.addDraft(campaign, session.id, AddDraft(session.revision, origin.id, origin.revision)).getOrNull()!!
        val frozen = session.items.last()
        frozen.provenance.kind shouldBe "authored"
        frozen.provenance.capture shouldBe null
        frozen.capturedSource!!.classification.metadata!!.status shouldBe "draft"
        frozen.markdown.endsWith(origin.fields.body) shouldBe true
        prep.addDraft(campaign, session.id, AddDraft(0, target.id, target.revision)).isLeft() shouldBe true
        revisions.get(campaign, target.id, target.revision) shouldBe null
        var rendered = prep.view(campaign, session.id).getOrNull()!!.items.last().source
        rendered.links[0].target shouldBe "origin"
        rendered.links[1].unavailable shouldBe true
        rendered.links[2].target shouldBe "@${session.items.first().id}#scene"
        rendered.links.drop(3).all { it.unavailable } shouldBe true
        rendered.html.contains("<script>") shouldBe false
        rendered.html.contains("<img") shouldBe false
        session = prep.addDraft(campaign, session.id, AddDraft(session.revision, target.id, target.revision)).getOrNull()!!
        rendered = prep.view(campaign, session.id).getOrNull()!!.items[1].source
        rendered.links[1].target shouldBe "@${session.items.last().id}#same-1"
        // Place the NPC between two source scenes; retain one mixed ordered collection and notes.
        session = prep.add(campaign, session.id, AddSource(session.revision, capture, "scene.md", null)).getOrNull()!!
        session = prep.save(campaign, session.id, SaveSession(session.revision, session.title, "", "Session notes", session.items.map { ItemNotes(it.id, "Notes for ${it.title}") })).getOrNull()!!
        val before = prep.view(campaign, session.id).getOrNull()!!
        var unmatched = prep.create(campaign, CreateSession("Exact target revisions", "")).getOrNull()!!
        unmatched = prep.addDraft(campaign, unmatched.id, AddDraft(unmatched.revision, origin.id, origin.revision)).getOrNull()!!
        writing.save(campaign, origin.id, SaveDraft(origin.revision, origin.fields.copy(title = "Changed", body = "# Changed", summary = "Changed"))).isRight() shouldBe true
        writing.save(campaign, target.id, SaveDraft(target.revision, target.fields.copy(body = "# Replacement"))).isRight() shouldBe true
        // Retaining a newer revision never changes existing frozen bindings to the old revision.
        unmatched = prep.addDraft(campaign, unmatched.id, AddDraft(unmatched.revision, target.id, target.revision + 1)).getOrNull()!!
        prep.view(campaign, unmatched.id).getOrNull()!!.items.first().source.links[1].unavailable shouldBe true
        Files.delete(root.resolve("scene.md")); sources.refresh(campaign).isRight() shouldBe true
        prep.open(campaign, session.id).getOrNull() shouldBe session
        prep.view(campaign, session.id).getOrNull() shouldBe before
        val archive = prep.export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!
        archive.version shouldBe 4
        val mapper = context!!.getBean(ObjectMapper::class.java)
        val reader = context!!.getBean(SessionArchiveReader::class.java)
        reader.read(mapper.writeValueAsBytes(archive)).getOrNull() shouldBe archive
        val count = prep.list(other).getOrNull()!!.sessions.size
        fun broken(change: (ObjectNode) -> Unit) {
            val tree = mapper.valueToTree<ObjectNode>(archive)
            val item = tree.path("sessions")[0].path("items")[1] as ObjectNode
            change(item)
            val parsed = reader.read(mapper.writeValueAsBytes(tree))
            if (parsed.isRight()) prep.import(other, parsed.getOrNull()!!).isLeft() shouldBe true
            prep.list(other).getOrNull()!!.sessions.size shouldBe count
        }
        broken { it.put("markdown", "Tampered") }
        broken { (it.path("provenance") as ObjectNode).put("kind", "source") }
        broken { (it.path("provenance").path("authored") as ObjectNode).put("revision", -1) }
        broken { (it.path("provenance").path("authored") as ObjectNode).put("unexpected", true) }
        broken { (it.path("provenance").path("authored").path("links")[1] as ObjectNode).put("revision", -1) }
        broken { (it.path("provenance").path("authored") as ObjectNode).put("original", "Invented evidence") }
        val importedId = prep.import(other, archive).getOrNull()!!.sessions.single().id
        val imported = prep.open(other, importedId).getOrNull()!!
        imported.items.map { it.provenance } shouldBe session.items.map { it.provenance }
        prep.view(other, importedId).getOrNull()!!.items[1].source.links[1].target shouldBe "@${imported.items[2].id}#same-1"
        writing.open(other, origin.id).isLeft() shouldBe true
        context!!.getBean(org.springframework.jdbc.core.JdbcTemplate::class.java).update("DELETE FROM writing.draft WHERE campaign = ?", campaign)
        prep.view(other, importedId).getOrNull()!!.items[1].source.links[1].target shouldBe "@${imported.items[2].id}#same-1"
        context!!.close(); context = start()
        context!!.getBean(PreparationService::class.java).open(campaign, session.id).getOrNull() shouldBe session
        context!!.getBean(PreparationService::class.java).open(other, importedId).getOrNull() shouldBe imported
        context!!.getBean(ApprovedRevisionStore::class.java).get(campaign, origin.id, origin.revision)!!.snapshot shouldBe origin
    }
    "copied source approval retains original evidence and failed oversized captures leave no retained revision" {
        val campaign = context!!.getBean(CampaignService::class.java).list().getOrNull()!!.campaigns.first { it.name == "Authoring" }.id
        val source = "# Original source\r\nUnchanged original evidence."
        Files.writeString(root.resolve("original: evidence.md"), source)
        val sources = context!!.getBean(SourceService::class.java)
        val capture = sources.refresh(campaign).getOrNull()!!.capture!!
        val fork = context!!.getBean(WritingExportService::class.java).fork(campaign, ForkDraft(capture, "original: evidence.md", "scene")).getOrNull()!!
        val writing = context!!.getBean(WritingService::class.java)
        val saved = writing.save(campaign, fork.id, SaveDraft(fork.revision, fork.fields.copy(title = "Fork", summary = "Fork summary", path = "fork.md"))).getOrNull()!!
        val prep = context!!.getBean(PreparationService::class.java)
        var session = prep.create(campaign, CreateSession("Fork capture", "")).getOrNull()!!
        session = prep.addDraft(campaign, session.id, AddDraft(session.revision, saved.id, saved.revision)).getOrNull()!!
        session.items.single().provenance.authored!!.original shouldBe source
        session.items.single().provenance.authored!!.originalCapture shouldBe capture
        Files.delete(root.resolve("original: evidence.md")); sources.refresh(campaign).isRight() shouldBe true
        val archive = prep.export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!
        prep.import(campaign, archive).isRight() shouldBe true
        val oversized = writing.save(campaign, saved.id, SaveDraft(saved.revision, saved.fields.copy(body = "x".repeat(2 * 1024 * 1024)))).getOrNull()!!
        prep.addDraft(campaign, session.id, AddDraft(session.revision, oversized.id, oversized.revision)).isLeft() shouldBe true
        context!!.getBean(ApprovedRevisionStore::class.java).get(campaign, saved.id, oversized.revision) shouldBe null
        prep.open(campaign, session.id).getOrNull() shouldBe session
    }

})
