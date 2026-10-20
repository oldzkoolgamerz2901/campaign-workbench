package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.ConfigurableApplicationContext
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.sources.application.SourceService
import workbench.sources.api.Authoring
import workbench.writing.api.*
import workbench.writing.application.WritingService
import workbench.writing.application.WritingExportService
import java.nio.file.Files
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.MessageDigest
import java.util.UUID

class WritingExportIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    var context: ConfigurableApplicationContext? = null
    val root = Files.createTempDirectory("writing-exports")
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively() }
    "copies retain source evidence and safe extras while artifact bytes survive edits and restart" {
        val originalCard = UUID.randomUUID()
        val body = "# Mira\r\nUnicode café 🌊\r\n## Same\r\n## Same\r\n[local](#same-1) [source](../place%20name.md#dock) [old](mira.md)\r\n"
        val raw = "\uFEFF---\r\ncustom: {number: 7, text: '007', flags: [true, null]}\r\nworkbench:\r\n  schema: 1\r\n  id: $originalCard\r\n  title: Mira\r\n  type: npc\r\n  purpose: session\r\n  status: current\r\n  tags: [Harbour]\r\n  extension: {enabled: true}\r\n---\r\n$body"
        Files.createDirectories(root.resolve("npcs")); Files.writeString(root.resolve("npcs/mira.md"), raw)
        Files.writeString(root.resolve("place name.md"), "# Dock\nHarbour")
        val campaign = context!!.getBean(CampaignService::class.java).register(RegisterCampaign("Exports", root.toString())).getOrNull()!!.id
        val sources = context!!.getBean(SourceService::class.java)
        val capture = sources.refresh(campaign).getOrNull()!!.capture!!
        var exports = context!!.getBean(WritingExportService::class.java)
        var writing = context!!.getBean(WritingService::class.java)
        val fork = exports.fork(campaign, ForkDraft(capture, "npcs/mira.md")).getOrNull()!!
        fork.fields.body shouldBe body
        fork.fields.status shouldBe "draft"
        (fork.card != originalCard && fork.id != fork.card) shouldBe true
        fork.origin!!.raw shouldBe raw
        fork.origin!!.card shouldBe originalCard
        fork.fields.path.startsWith("npcs/mira-draft-") shouldBe true
        val report = exports.inspect(campaign, fork.id, InspectExport(0, capture)).getOrNull()!!
        report.errors shouldBe emptyList()
        report.links.map { it.kind } shouldBe listOf("local", "source", "source")
        report.links[1].path shouldBe "place name.md"
        report.warnings.isNotEmpty() shouldBe true
        exports.create(campaign, fork.id, CreateExport(0, capture, report.fingerprint, false)).isLeft() shouldBe true
        val artifact = exports.create(campaign, fork.id, CreateExport(0, capture, report.fingerprint, true)).getOrNull()!!
        exports.create(campaign, fork.id, CreateExport(0, capture, report.fingerprint, true)).getOrNull()!!.id shouldBe artifact.id
        artifact.report.markdown.endsWith(body) shouldBe true
        artifact.report.markdown shouldContain "extension:"
        val hash = MessageDigest.getInstance("SHA-256").digest(artifact.report.markdown.toByteArray()).joinToString("") { "%02x".format(it) }
        artifact.report.hash shouldBe hash
        val decoded = context!!.getBean(Authoring::class.java).decode(artifact.report.markdown)
        decoded.errors shouldBe emptyList()
        decoded.body shouldBe body
        decoded.retainedEnvelope shouldContain "custom:"
        Files.readString(root.resolve("npcs/mira.md")) shouldBe raw
        val saved = writing.save(campaign, fork.id, SaveDraft(0, fork.fields.copy(title = "Edited", path = "moved/mira.md"))).getOrNull()!!
        exports.create(campaign, fork.id, CreateExport(0, capture, report.fingerprint, true)).isLeft() shouldBe true
        val moved = exports.inspect(campaign, fork.id, InspectExport(saved.revision, capture)).getOrNull()!!
        moved.warnings.any { it.contains("directory differs") } shouldBe true
        Files.delete(root.resolve("npcs/mira.md"))
        sources.refresh(campaign).isRight() shouldBe true
        val before = writing.list(campaign).getOrNull()!!.drafts.size
        exports.fork(campaign, ForkDraft(capture, "npcs/mira.md")).isLeft() shouldBe true
        writing.list(campaign).getOrNull()!!.drafts.size shouldBe before
        exports.create(campaign, fork.id, CreateExport(saved.revision, capture, moved.fingerprint, true)).isLeft() shouldBe true
        context!!.close(); context = start()
        exports = context!!.getBean(WritingExportService::class.java)
        writing = context!!.getBean(WritingService::class.java)
        writing.open(campaign, fork.id).getOrNull()!!.origin!!.raw shouldBe raw
        exports.history(campaign, fork.id).getOrNull()!!.artifacts.single().id shouldBe artifact.id
        exports.artifact(campaign, fork.id, artifact.id).getOrNull()!!.markdown shouldBe artifact.report.markdown
        val port = (context as WebServerApplicationContext).webServer!!.port
        val response = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI("http://127.0.0.1:$port/api/campaigns/$campaign/drafts/${fork.id}/exports/${artifact.id}/markdown")).header("Accept", "text/markdown").GET().build(), HttpResponse.BodyHandlers.ofByteArray())
        response.statusCode() shouldBe 200
        response.body().toList() shouldBe artifact.report.markdown.toByteArray().toList()
        response.headers().firstValue("X-Content-SHA256").get() shouldBe hash
        exports.artifact(campaign, UUID.randomUUID(), artifact.id).isLeft() shouldBe true
    }
    "legacy requires a type and unsupported envelopes do not create partial drafts" {
        val campaign = context!!.getBean(CampaignService::class.java).list().getOrNull()!!.campaigns.first().id
        val sources = context!!.getBean(SourceService::class.java)
        val exports = context!!.getBean(WritingExportService::class.java)
        val writing = context!!.getBean(WritingService::class.java)
        Files.writeString(root.resolve("legacy.md"), "---\nauthor: human\n---\n# Legacy\nBody")
        Files.writeString(root.resolve("bad.md"), "---\nworkbench: {schema: 2, type: npc}\n---\nStill readable")
        val capture = sources.refresh(campaign).getOrNull()!!.capture!!
        val count = writing.list(campaign).getOrNull()!!.drafts.size
        exports.fork(campaign, ForkDraft(capture, "legacy.md")).isLeft() shouldBe true
        exports.fork(campaign, ForkDraft(capture, "bad.md", "npc")).isLeft() shouldBe true
        writing.list(campaign).getOrNull()!!.drafts.size shouldBe count
        val copied = exports.fork(campaign, ForkDraft(capture, "legacy.md", "item")).getOrNull()!!
        copied.fields.type shouldBe "item"
        copied.fields.body shouldBe "# Legacy\nBody"
        copied.origin!!.retainedEnvelope shouldContain "author: human"
        for (path in listOf("../x.md", "/x.md", "C:x.md", "a//b.md", "a/./b.md", "x.md?q", "x.md#h", "x\\a.md", "x.txt")) {
            val saved = writing.save(campaign, copied.id, SaveDraft(writing.open(campaign, copied.id).getOrNull()!!.revision, copied.fields.copy(path = path))).getOrNull()!!
            exports.inspect(campaign, copied.id, InspectExport(saved.revision, capture)).getOrNull()!!.errors.isNotEmpty() shouldBe true
        }
    }
    "target revisions and ambiguous placements invalidate an acknowledged report" {
        val campaign = context!!.getBean(CampaignService::class.java).list().getOrNull()!!.campaigns.first().id
        val capture = context!!.getBean(SourceService::class.java).authoringLibrary(campaign).getOrNull()!!.capture
        val exports = context!!.getBean(WritingExportService::class.java)
        val writing = context!!.getBean(WritingService::class.java)
        val target = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        writing.save(campaign, target.id, SaveDraft(0, target.fields.copy(title = "Target", path = "target.md", body = "# Heading"))).isRight() shouldBe true
        val origin = writing.create(campaign, CreateDraft("scene", false)).getOrNull()!!
        val saved = writing.save(campaign, origin.id, SaveDraft(0, origin.fields.copy(title = "Origin", path = "origin.md", body = "[target](target.md#heading) [escape](../outside.md) [query](target.md?q=1) [unsafe](javascript:alert) [external](https://example.com)"))).getOrNull()!!
        val report = exports.inspect(campaign, origin.id, InspectExport(saved.revision, capture)).getOrNull()!!
        report.links.map { it.kind } shouldBe listOf("draft", "unsupported", "unsupported", "unsupported", "external")
        report.targetRevisions[target.id.toString()] shouldBe 1
        writing.save(campaign, target.id, SaveDraft(1, target.fields.copy(title = "Target", path = "target.md", body = "# Changed"))).isRight() shouldBe true
        exports.create(campaign, origin.id, CreateExport(saved.revision, capture, report.fingerprint, true)).leftOrNull()!!.code shouldBe "writing.export-stale"
        val duplicate = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        writing.save(campaign, duplicate.id, SaveDraft(0, duplicate.fields.copy(path = "target.md"))).isRight() shouldBe true
        exports.inspect(campaign, origin.id, InspectExport(saved.revision, capture)).getOrNull()!!.links.first().kind shouldBe "ambiguous"
        exports.history(campaign, origin.id).getOrNull()!!.artifacts shouldBe emptyList()
    }
})
