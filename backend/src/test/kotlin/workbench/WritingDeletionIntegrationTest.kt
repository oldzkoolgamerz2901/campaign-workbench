package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.platform.api.*
import workbench.sources.application.SourceService
import workbench.preparation.api.*
import workbench.preparation.application.PreparationService
import workbench.writing.api.*
import workbench.writing.application.*
import java.nio.file.Files
import java.util.UUID
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import org.springframework.boot.web.server.context.WebServerApplicationContext
import tools.jackson.databind.ObjectMapper
import org.flywaydb.core.Flyway
import java.sql.DriverManager
import java.util.concurrent.*

class WritingDeletionIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("writing-delete")
    val otherRoot = Files.createTempDirectory("writing-delete-other")
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    var context: org.springframework.context.ConfigurableApplicationContext? = null
    val migratedCampaign = UUID.randomUUID()
    val migratedDraft = UUID.randomUUID()
    val migratedExport = UUID.randomUUID()
    beforeSpec {
        database.start()
        Flyway.configure().dataSource(database.jdbcUrl, database.username, database.password)
            .defaultSchema("workbench_setup").target("10").load().migrate()
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
            connection.prepareStatement("INSERT INTO campaigns.campaign VALUES (?, 'Pre-V11', ?, '**/*.md', '', 0)").use {
                it.setObject(1, migratedCampaign); it.setString(2, root.resolve("before-v11").toString()); it.executeUpdate()
            }
            connection.prepareStatement("INSERT INTO writing.draft(id,campaign,card,revision,title,type,status,tags,summary,body,path) VALUES (?,?,?,0,'Old draft','npc','draft','[]','','Body','old.md')").use {
                it.setObject(1, migratedDraft); it.setObject(2, migratedCampaign); it.setObject(3, UUID.randomUUID()); it.executeUpdate()
            }
            connection.prepareStatement("INSERT INTO writing.export_artifact VALUES (?,?,?,0,'2026-10-20T00:00:00Z','opaque retained payload','opaque retained summary')").use {
                it.setObject(1, migratedExport); it.setObject(2, migratedCampaign); it.setObject(3, migratedDraft); it.executeUpdate()
            }
        }
        context = start()
    }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively(); otherRoot.toFile().deleteRecursively() }
    "V11 upgrades existing drafts and exports without changing historical payloads or campaign ownership" {
        val jdbc = context!!.getBean(org.springframework.jdbc.core.JdbcTemplate::class.java)
        jdbc.queryForObject("SELECT payload FROM writing.export_artifact WHERE id = ?", String::class.java, migratedExport) shouldBe "opaque retained payload"
        jdbc.queryForObject("SELECT summary FROM writing.export_artifact WHERE id = ?", String::class.java, migratedExport) shouldBe "opaque retained summary"
        jdbc.queryForObject("SELECT count(*) FROM pg_constraint WHERE conrelid = 'writing.export_artifact'::regclass AND conname = 'export_artifact_campaign_fkey'", Long::class.java) shouldBe 1
        context!!.getBean(WritingService::class.java).delete(migratedCampaign, migratedDraft, 0).isRight() shouldBe true
        jdbc.queryForObject("SELECT campaign FROM writing.export_artifact WHERE id = ?", UUID::class.java, migratedExport) shouldBe migratedCampaign
        jdbc.queryForObject("SELECT count(*) FROM writing.export_artifact WHERE id = ?", Long::class.java, migratedExport) shouldBe 1
    }
    "HTTP deletion rejects missing or malformed revision without changing the draft and preserves stale and success responses" {
        val c = context!!
        val campaign = c.getBean(CampaignService::class.java).list().getOrNull()!!.campaigns.first().id
        val writing = c.getBean(WritingService::class.java)
        val draft = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        val mapper = c.getBean(ObjectMapper::class.java)
        val port = (c as WebServerApplicationContext).webServer!!.port
        val url = "http://127.0.0.1:$port/api/campaigns/$campaign/drafts/${draft.id}"
        val client = HttpClient.newHttpClient()
        fun delete(query: String, accept: String = "application/json") = client.send(HttpRequest.newBuilder(URI(url + query))
            .header("Accept", accept).DELETE().build(), HttpResponse.BodyHandlers.ofString())
        for (accept in listOf("application/json", "application/problem+json")) {
            for (query in listOf("", "?revision=-1", "?revision=0.5", "?revision=9223372036854775808")) {
                val response = delete(query, accept)
                response.statusCode() shouldBe 400
                (response.headers().firstValue("Content-Type").orElse("").substringBefore(';') in setOf("application/json", "application/problem+json")) shouldBe true
                val problem = mapper.readTree(response.body())
                problem.path("status").intValue() shouldBe 400
                problem.path("code").asString() shouldBe if (query == "?revision=-1") "writing.invalid" else "request.invalid"
                writing.open(campaign, draft.id).getOrNull() shouldBe draft
            }
        }
        val saved = writing.save(campaign, draft.id, SaveDraft(0, draft.fields.copy(title = "New revision"))).getOrNull()!!
        val stale = delete("?revision=0")
        stale.statusCode() shouldBe 409
        mapper.readTree(stale.body()).path("code").asString() shouldBe "writing.stale-revision"
        writing.open(campaign, draft.id).getOrNull() shouldBe saved
        val success = delete("?revision=1")
        success.statusCode() shouldBe 204
        success.body() shouldBe ""
        writing.open(campaign, draft.id).isLeft() shouldBe true
        delete("?revision=1").statusCode() shouldBe 404
    }
    "deletion preserves orphan exported and approved history, prepared copies and existing recovery after restart" {
        val c = context!!
        val campaigns = c.getBean(CampaignService::class.java)
        val campaign = campaigns.register(RegisterCampaign("Delete origin", root.toString())).getOrNull()!!.id
        val other = campaigns.register(RegisterCampaign("Delete other", otherRoot.toString())).getOrNull()!!.id
        val sources = c.getBean(SourceService::class.java)
        val writing = c.getBean(WritingService::class.java)
        val exports = c.getBean(WritingExportService::class.java)
        val prep = c.getBean(PreparationService::class.java)
        val recovery = c.getBean(RecoveryService::class.java)
        val revisions = c.getBean(ApprovedRevisionStore::class.java)
        val codec = c.getBean(RecoveryCodec::class.java)
        Files.writeString(root.resolve("source.md"), "# Original\r\nSource bytes stay unchanged.\r\n")
        val original = Files.readAllBytes(root.resolve("source.md"))
        val capture = sources.refresh(campaign).getOrNull()!!.capture!!
        val d = exports.fork(campaign, ForkDraft(capture, "source.md", "scene")).getOrNull()!!
        val draft = writing.save(campaign, d.id, SaveDraft(0, d.fields.copy(title = "Delete me", path = "deleted.md"))).getOrNull()!!
        val keep = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        val unexported = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
        writing.delete(other, draft.id, 1).leftOrNull()!!.code shouldBe "writing.not-found"
        writing.delete(campaign, draft.id, -1).isLeft() shouldBe true
        writing.delete(campaign, draft.id, 0).leftOrNull()!!.code shouldBe "writing.stale-revision"
        writing.open(campaign, draft.id).getOrNull() shouldBe draft
        val report = exports.inspect(campaign, draft.id, InspectExport(1, capture)).getOrNull()!!
        val artifact = exports.create(campaign, draft.id, CreateExport(1, capture, report.fingerprint, true)).getOrNull()!!
        var session = prep.create(campaign, CreateSession("Frozen", "")).getOrNull()!!
        session = prep.add(campaign, session.id, AddSource(0, capture, "source.md", null)).getOrNull()!!
        session = prep.addDraft(campaign, session.id, AddDraft(session.revision, draft.id, 1)).getOrNull()!!
        session = prep.save(campaign, session.id, SaveSession(session.revision, session.title, "", "Session note", session.items.map { ItemNotes(it.id, "Item note") })).getOrNull()!!
        val view = prep.view(campaign, session.id).getOrNull()!!
        val retained = revisions.get(campaign, draft.id, 1)!!
        val oldWorkspace = recovery.restore(recovery.backup(campaign).getOrNull()!!).getOrNull()!!
        val oldArchive = recovery.archive(oldWorkspace.id).getOrNull()!!
        val tx = c.getBean(Transactions::class.java)
        tx.run<Unit> { writing.delete(campaign, draft.id, 1).isRight() shouldBe true; Either.Left(Failure.Invalid("test.rollback", "rollback")) }.isLeft() shouldBe true
        writing.open(campaign, draft.id).getOrNull() shouldBe draft
        writing.delete(campaign, draft.id, 1).isRight() shouldBe true
        writing.delete(campaign, unexported.id, 0).isRight() shouldBe true
        writing.delete(campaign, draft.id, 1).leftOrNull()!!.code shouldBe "writing.not-found"
        writing.save(campaign, draft.id, SaveDraft(1, draft.fields)).leftOrNull()!!.code shouldBe "writing.not-found"
        prep.addDraft(campaign, session.id, AddDraft(session.revision, draft.id, 1)).isLeft() shouldBe true
        writing.list(campaign).getOrNull()!!.drafts shouldBe listOf(keep)
        prep.open(campaign, session.id).getOrNull() shouldBe session
        prep.view(campaign, session.id).getOrNull() shouldBe view
        revisions.get(campaign, draft.id, 1) shouldBe retained
        Files.readAllBytes(root.resolve("source.md")).contentEquals(original) shouldBe true
        recovery.archive(oldWorkspace.id).getOrNull()!!.contentEquals(oldArchive) shouldBe true
        val orphanArchive = codec.read(recovery.backup(campaign).getOrNull()!!)
        orphanArchive.drafts shouldBe listOf(keep)
        orphanArchive.approved.single().snapshot shouldBe draft
        orphanArchive.exports.single().report.markdown shouldBe artifact.report.markdown
        val restored = recovery.restore(codec.write(orphanArchive)).getOrNull()!!
        recovery.detail(restored.id, "export:${artifact.id}").getOrNull()!!.markdown shouldBe artifact.report.markdown
        val jdbc = c.getBean(org.springframework.jdbc.core.JdbcTemplate::class.java)
        jdbc.queryForObject("SELECT count(*) FROM writing.export_artifact WHERE campaign = ? AND draft = ?", Long::class.java, campaign, draft.id) shouldBe 1
        context!!.close(); context = start()
        context!!.getBean(WritingService::class.java).open(campaign, draft.id).isLeft() shouldBe true
        context!!.getBean(PreparationService::class.java).view(campaign, session.id).getOrNull() shouldBe view
        context!!.getBean(RecoveryService::class.java).detail(restored.id, "export:${artifact.id}").getOrNull()!!.markdown shouldBe artifact.report.markdown
    }
    "campaign lock rejects a stale deletion after a save and a late save cannot resurrect a deleted row" {
        val c = context!!
        val campaigns = c.getBean(CampaignService::class.java)
        val campaign = campaigns.list().getOrNull()!!.campaigns.first().id
        val writing = c.getBean(WritingService::class.java)
        val tx = c.getBean(Transactions::class.java)
        val executor = Executors.newFixedThreadPool(2)
        fun ordered(first: () -> Unit, second: () -> Unit) {
            val locked = CountDownLatch(1); val release = CountDownLatch(1); val secondStarted = CountDownLatch(1)
            try {
                val a = executor.submit { tx.run { campaigns.configuration(campaign); first(); locked.countDown(); check(release.await(5, TimeUnit.SECONDS)); Either.Right(Unit) } }
                check(locked.await(5, TimeUnit.SECONDS))
                val b = executor.submit { secondStarted.countDown(); second() }
                check(secondStarted.await(5, TimeUnit.SECONDS))
                try { b.get(100, TimeUnit.MILLISECONDS); error("Mutation bypassed campaign lock") } catch (_: TimeoutException) { }
                release.countDown(); a.get(5, TimeUnit.SECONDS); b.get(5, TimeUnit.SECONDS)
            } finally { release.countDown() }
        }
        try {
            val draft = writing.create(campaign, CreateDraft("npc", false)).getOrNull()!!
            ordered({ writing.save(campaign, draft.id, SaveDraft(0, draft.fields.copy(title = "New revision"))).isRight() shouldBe true },
                { writing.delete(campaign, draft.id, 0).leftOrNull()!!.code shouldBe "writing.stale-revision" })
            writing.open(campaign, draft.id).getOrNull()!!.revision shouldBe 1
            ordered({ writing.delete(campaign, draft.id, 1).isRight() shouldBe true },
                { writing.save(campaign, draft.id, SaveDraft(1, draft.fields)).leftOrNull()!!.code shouldBe "writing.not-found" })
            writing.open(campaign, draft.id).isLeft() shouldBe true
        } finally { executor.shutdownNow() }
    }
})
