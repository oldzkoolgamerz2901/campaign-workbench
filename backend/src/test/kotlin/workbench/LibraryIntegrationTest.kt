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
        Files.createDirectories(other.resolve("different")); Files.writeString(other.resolve("different/else.md"), "# Else\nOther campaign")
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
        restartedSources.refresh(first.id).getOrNull()!!.documents.size shouldBe 0
        Files.readString(root.resolve("source.md")) shouldBe "# Changed\nNew words"
    }
})
