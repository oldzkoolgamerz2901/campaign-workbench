package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.*
import workbench.campaigns.application.CampaignService
import workbench.platform.api.*
import workbench.sources.application.SourceService
import workbench.sources.application.CaptureStore
import workbench.sources.domain.Capture
import workbench.preparation.application.PreparationService
import workbench.preparation.api.CreateSession
import workbench.preparation.api.AddSource
import java.nio.file.Files
import java.net.URI
import java.net.http.*
import java.util.UUID

class LibraryIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    var context: ConfigurableApplicationContext? = null
    val root = Files.createTempDirectory("workbench-library-integration")
    val other = Files.createTempDirectory("workbench-other-campaign")
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run(
        "--server.port=0", "--spring.datasource.url=${database.jdbcUrl}",
        "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively(); other.toFile().deleteRecursively() }
    "real migrations, API schemas, isolation, persistence and rollback preserve the library" {
        Files.writeString(root.resolve("source.md"), "# Original\nUnique needle")
        Files.createDirectories(other.resolve("different"))
        val typed = "---\nworkbench:\n  schema: 1\n  id: '87b085da-326b-4cc4-933e-c908648ee712'\n  title: Other metadata\n  type: scene\n  purpose: session\n  status: current\n  tags: [Reef, combat]\n---\n# Else\nOther campaign"
        Files.writeString(other.resolve("different/else.md"), typed)
        Files.writeString(other.resolve("guidance.md"), typed.replace("87b085da-326b-4cc4-933e-c908648ee712", "87b085da-326b-4cc4-933e-c908648ee713").replace("purpose: session", "purpose: guidance"))
        Files.writeString(other.resolve("invalid.md"), "---\nworkbench: [invalid\n---\n# Readable\nMalformed metadata remains readable")
        val app = context!!
        val campaigns = app.getBean(CampaignService::class.java)
        val sources = app.getBean(SourceService::class.java)
        val first = campaigns.register(RegisterCampaign("First", root.toString())).getOrNull()!!
        val second = campaigns.register(RegisterCampaign("Second", other.toString())).getOrNull()!!
        campaigns.register(RegisterCampaign("Duplicate", root.resolve(".").toString())).leftOrNull()!!.code shouldBe "campaign.duplicate"
        campaigns.register(RegisterCampaign("Missing", root.resolve("absent").toString())).isLeft() shouldBe true
        campaigns.select(first.id).isRight() shouldBe true
        val initial = sources.refresh(first.id).getOrNull()!!.capture!!
        val secondCapture = sources.refresh(second.id).getOrNull()!!.capture!!
        sources.search(second.id, secondCapture, "needle").getOrNull()!!.hits.size shouldBe 0
        sources.document(second.id, initial, "source.md").isLeft() shouldBe true
        Files.writeString(root.resolve("source.md"), "# Changed\nNew words")
        sources.search(first.id, initial, "needle").getOrNull()!!.hits.size shouldBe 1
        // Either.Left after actual writes must roll back, as must unexpected exceptions.
        val tx = app.getBean(Transactions::class.java)
        val jdbc = app.getBean(JdbcTemplate::class.java)
        tx.run<Unit> {
            jdbc.update("UPDATE campaigns.campaign SET name = 'bad' WHERE id = ?", first.id)
            Either.Left(Failure.Invalid("test.rollback", "Expected failure"))
        }.isLeft() shouldBe true
        campaigns.list().getOrNull()!!.campaigns.first { it.id == first.id }.name shouldBe "First"
        try { tx.run<Unit> { jdbc.update("UPDATE campaigns.campaign SET name = 'bad' WHERE id = ?", first.id); error("Unexpected") } } catch (_: IllegalStateException) { }
        campaigns.list().getOrNull()!!.campaigns.first { it.id == first.id }.name shouldBe "First"
        val captureStore = app.getBean(CaptureStore::class.java)
        tx.run<Unit> {
            captureStore.publish(Capture(first.id, UUID.randomUUID(), 0, mapOf("partial.md" to "Partial")))
            Either.Left(Failure.Conflict("test.capture-rollback", "Expected publication failure"))
        }.isLeft() shouldBe true
        sources.library(first.id).getOrNull()!!.capture shouldBe initial
        sources.search(first.id, initial, "needle").getOrNull()!!.hits.size shouldBe 1
        val port = (app as WebServerApplicationContext).webServer!!.port
        val client = HttpClient.newHttpClient()
        fun get(path: String) = client.send(HttpRequest.newBuilder(URI("http://127.0.0.1:$port$path")).GET().build(), HttpResponse.BodyHandlers.ofString())
        get("/v3/api-docs").body().let { it shouldContain "SourceDocument"; it shouldContain "CampaignList"; it shouldContain "ProblemResponse" }
        get("/api/campaigns/${first.id}/sources/document?capture=$initial&path=source.md").statusCode() shouldBe 200
        val filtered = get("/api/campaigns/${second.id}/sources?types=npc&types=scene&tags=reef&tags=combat&purposes=session&statuses=current")
        filtered.statusCode() shouldBe 200
        filtered.body() shouldContain "different/else.md"
        filtered.body().contains("guidance.md") shouldBe false
        val issues = get("/api/campaigns/${second.id}/sources?issues=true&unclassified=true")
        issues.statusCode() shouldBe 200
        issues.body() shouldContain "invalid.md"
        issues.body().contains("different/else.md") shouldBe false
        get("/api/campaigns/${second.id}/sources/search?capture=$secondCapture&query=Other&types=scene&purposes=session").let {
            it.statusCode() shouldBe 200; it.body() shouldContain "different/else.md"; it.body().contains("guidance.md") shouldBe false
        }
        get("/api/campaigns/${second.id}/sources/document?capture=$secondCapture&path=invalid.md").let {
            it.statusCode() shouldBe 200; it.body() shouldContain "metadata.yaml"; it.body() shouldContain "Readable"
        }
        val preparation = app.getBean(PreparationService::class.java)
        val session = preparation.create(second.id, CreateSession("Restriction check", "")).getOrNull()!!
        preparation.add(second.id, session.id, AddSource(session.revision, secondCapture, "guidance.md", null)).leftOrNull()!!.code shouldBe "sources.not-session-material"
        preparation.open(second.id, session.id).getOrNull() shouldBe session
        val refreshed = sources.refresh(first.id).getOrNull()!!.capture!!
        get("/api/campaigns/${first.id}/sources/document?capture=$initial&path=source.md").let { it.statusCode() shouldBe 409; it.body() shouldContain "sources.capture-replaced" }
        campaigns.configure(first.id, ConfigureCampaign(first.includes, first.excludes + "source.md", first.revision)).isRight() shouldBe true
        sources.library(first.id).getOrNull()!!.needsRefresh shouldBe true
        context!!.close(); context = start()
        val restartedCampaigns = context!!.getBean(CampaignService::class.java)
        val restartedSources = context!!.getBean(SourceService::class.java)
        restartedCampaigns.list().getOrNull()!!.let { it.selected shouldBe first.id; it.campaigns.size shouldBe 2 }
        restartedSources.library(first.id).getOrNull()!!.capture shouldBe refreshed
        restartedSources.document(first.id, refreshed, "source.md").getOrNull()!!.sections.first().heading shouldBe "Changed"
        restartedSources.document(second.id, secondCapture, "different/else.md").getOrNull()!!.classification.metadata!!.tags shouldBe listOf("reef", "combat")
        restartedSources.refresh(first.id).getOrNull()!!.documents.size shouldBe 0
        Files.readString(root.resolve("source.md")) shouldBe "# Changed\nNew words"
    }
})
