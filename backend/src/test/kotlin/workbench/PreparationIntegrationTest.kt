package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.context.ConfigurableApplicationContext
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.sources.application.SourceService
import workbench.preparation.application.*
import workbench.preparation.api.*
import workbench.preparation.domain.Session
import workbench.platform.api.*
import java.nio.file.Files
import java.util.UUID

class PreparationIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    var context: ConfigurableApplicationContext? = null
    val root = Files.createTempDirectory("workbench-preparation")
    val other = Files.createTempDirectory("workbench-preparation-other")
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively(); other.toFile().deleteRecursively() }
    "prepared snapshots persist, isolate, conflict, roll back and round trip without sources" {
        val original = "Preamble\r\n\r\n# Parent\r\nOne\r\n## Child\r\nNested\r\n## Child\r\nRepeated\r\n# Next\r\nTail"
        Files.writeString(root.resolve("source.md"), original)
        val c = context!!.getBean(CampaignService::class.java)
        val sources = context!!.getBean(SourceService::class.java)
        val p = context!!.getBean(PreparationService::class.java)
        val a = c.register(RegisterCampaign("First", root.toString())).getOrNull()!!.id
        val b = c.register(RegisterCampaign("Second", other.toString())).getOrNull()!!.id
        val capture = sources.refresh(a).getOrNull()!!.capture!!
        val document = sources.document(a, capture, "source.md").getOrNull()!!
        sources.select(a, capture, "source.md", null).getOrNull()!!.markdown shouldBe original
        sources.select(a, capture, "source.md", "start").getOrNull()!!.markdown shouldBe "Preamble\r\n\r\n"
        val parent = document.sections.first { it.heading == "Parent" }.id
        sources.select(a, capture, "source.md", parent).getOrNull()!!.markdown shouldBe original.substring(original.indexOf("# Parent"), original.indexOf("# Next"))
        val last = document.sections.last().id
        sources.select(a, capture, "source.md", last).getOrNull()!!.markdown shouldBe "# Next\r\nTail"
        var s = p.create(a, CreateSession("Night one", "Find the observatory")).getOrNull()!!
        p.open(b, s.id).isLeft() shouldBe true
        s = p.addHistoricalSource(context!!, a, s.id, HistoricalSource(s.revision, capture, "source.md", null)).getOrNull()!!
        s = p.addHistoricalSource(context!!, a, s.id, HistoricalSource(s.revision, capture, "source.md", parent)).getOrNull()!!
        val frozen = s.items.first().markdown
        val saved = p.save(a, s.id, SaveSession(s.revision, s.title, s.objective, "Session **notes**", s.items.reversed().map { ItemNotes(it.id, "Item notes") })).getOrNull()!!
        p.save(a, s.id, SaveSession(s.revision, "Stale", "", "", emptyList())).leftOrNull()!!.code shouldBe "preparation.stale-revision"
        val tx = context!!.getBean(Transactions::class.java)
        val store = context!!.getBean(SessionStore::class.java)
        tx.run<Unit> { store.put(Session(UUID.randomUUID(), a, 0, "Partial", "", "", emptyList())); Either.Left(Failure.Invalid("test.rollback", "Rollback")) }.isLeft() shouldBe true
        p.list(a).getOrNull()!!.sessions.size shouldBe 1
        val archive = p.export(a, ExportSessions(listOf(s.id))).getOrNull()!!
        p.import(b, archive.copy(version = 99)).isLeft() shouldBe true
        p.import(b, archive.copy(sessions = archive.sessions + archive.sessions)).isLeft() shouldBe true
        p.list(b).getOrNull()!!.sessions.size shouldBe 0
        p.import(b, archive.copy(sessions = listOf(saved.copy(items = saved.items.map { it.copy(markdown = "Tampered") })))).isLeft() shouldBe true
        p.import(b, archive.copy(sessions = archive.sessions.map { session -> session.copy(items = session.items.map { item ->
            if (item.provenance.section == null) item.copy(provenance = item.provenance.copy(documentHash = "0".repeat(64))) else item
        }) })).isLeft() shouldBe true
        val beforeImport = p.list(b).getOrNull()!!.sessions.size
        tx.run<Unit> {
            p.import(b, archive.copy(sessions = archive.sessions + archive.sessions.map { it.copy(id = UUID.randomUUID(), items = it.items.map { item -> item.copy(id = UUID.randomUUID()) }) })).isRight() shouldBe true
            Either.Left(Failure.Invalid("test.import-rollback", "Rollback after both sessions were written"))
        }.isLeft() shouldBe true
        p.list(b).getOrNull()!!.sessions.size shouldBe beforeImport
        p.import(b, archive.copy(sessions = List(101) { archive.sessions.single().copy(id = UUID.randomUUID()) })).isLeft() shouldBe true
        p.save(a, saved.id, SaveSession(saved.revision, saved.title, saved.objective, "x".repeat(2 * 1024 * 1024 + 1), saved.items.map { ItemNotes(it.id, it.notes) })).isLeft() shouldBe true
        p.open(a, saved.id).getOrNull() shouldBe saved
        val firstImport = p.import(b, archive).getOrNull()!!.sessions.single().id
        val secondImport = p.import(b, archive).getOrNull()!!.sessions.single().id
        (firstImport != secondImport && firstImport != s.id) shouldBe true
        p.open(b, firstImport).getOrNull()!!.items.map { it.notes } shouldBe saved.items.map { it.notes }
        Files.delete(root.resolve("source.md")); sources.refresh(a).isRight() shouldBe true
        sources.select(a, capture, "source.md", parent).leftOrNull()!!.code shouldBe "sources.capture-replaced"
        p.open(a, s.id).getOrNull()!!.items.last().markdown shouldBe frozen
        p.view(a, s.id).getOrNull()!!.notes.html shouldContain "<strong>notes</strong>"
        context!!.close(); context = start()
        val restarted = context!!.getBean(PreparationService::class.java)
        restarted.open(a, s.id).getOrNull() shouldBe saved
        restarted.open(b, firstImport).getOrNull()!!.items.map { it.provenance } shouldBe saved.items.map { it.provenance }
        val removed = restarted.save(a, s.id, SaveSession(saved.revision, saved.title, saved.objective, saved.notes, listOf(ItemNotes(saved.items.last().id, "Only")))).getOrNull()!!
        removed.items.size shouldBe 1
        restarted.open(a, s.id).getOrNull()!!.items.single().notes shouldBe "Only"
    }
    "safe rendering retains tables and local duplicate anchors without fetching images or live targets" {
        val p = context!!.getBean(PreparationService::class.java)
        val rendered = p.preview(MarkdownInput("# Same\n# Same\n[local](#same-1) [missing](other.md) [unsafe](javascript:alert(1)) ![remote](https://example.invalid/x.png)\n\n<script>alert(1)</script>\n\n| A | B |\n| - | - |\n| x | y |" )).getOrNull()!!
        rendered.html shouldContain "<table>"
        rendered.html.contains("<script>") shouldBe false
        rendered.html.contains("<img") shouldBe false
        rendered.links.first().target shouldBe "same-1"
        rendered.links.drop(1).all { it.unavailable } shouldBe true
        rendered.html shouldContain "outside captured material"
    }
    "frozen links use original duplicate anchors and never resolve against the live library" {
        val c = context!!.getBean(CampaignService::class.java)
        val sources = context!!.getBean(SourceService::class.java)
        val p = context!!.getBean(PreparationService::class.java)
        val campaign = c.list().getOrNull()!!.campaigns.first { it.name == "First" }.id
        Files.writeString(root.resolve("origin.md"), "# Origin\n[second](target.md#same-1) [first](target.md#same) [outside](uncaptured.md)")
        Files.writeString(root.resolve("target.md"), "# Same\nOutside selection\n# Same\nCaptured second\n[self](#same-1) [outside](#same)")
        val capture = sources.refresh(campaign).getOrNull()!!.capture!!
        val target = sources.document(campaign, capture, "target.md").getOrNull()!!.sections.last().id
        sources.select(campaign, capture, "target.md", target).getOrNull()!!.anchors shouldBe mapOf("same-1" to "same")
        var session = p.create(campaign, CreateSession("Frozen links", "")).getOrNull()!!
        session = p.addHistoricalSource(context!!, campaign, session.id, HistoricalSource(session.revision, capture, "origin.md", null)).getOrNull()!!
        session = p.addHistoricalSource(context!!, campaign, session.id, HistoricalSource(session.revision, capture, "target.md", target)).getOrNull()!!
        val view = p.view(campaign, session.id).getOrNull()!!
        view.items.first().source.links.first().target shouldBe "@${session.items.last().id}#same"
        view.items.first().source.links.drop(1).all { it.unavailable } shouldBe true
        view.items.last().source.links.first().target shouldBe "same"
        view.items.last().source.links.last().unavailable shouldBe true
        Files.writeString(root.resolve("target.md"), "# Same\nNew text")
        sources.refresh(campaign).isRight() shouldBe true
        p.view(campaign, session.id).getOrNull() shouldBe view
        val archive = p.export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!
        val imported = p.import(campaign, archive).getOrNull()!!.sessions.single().id
        val importedData = p.open(campaign, imported).getOrNull()!!
        p.view(campaign, imported).getOrNull()!!.items.first().source.links.first().target shouldBe "@${importedData.items.last().id}#same"
    }

})
