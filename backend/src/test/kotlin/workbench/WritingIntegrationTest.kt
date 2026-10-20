package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.context.ConfigurableApplicationContext
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.writing.api.*
import workbench.writing.application.WritingService
import workbench.platform.api.Transactions
import workbench.platform.api.Failure
import arrow.core.Either
import java.nio.file.Files

class WritingIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    var context: ConfigurableApplicationContext? = null
    val root = Files.createTempDirectory("writing-first")
    val other = Files.createTempDirectory("writing-other")
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    beforeSpec { database.start(); context = start() }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively(); other.toFile().deleteRecursively() }
    "working drafts preserve incomplete fields, isolate campaigns, reject stale writes and survive restart" {
        val campaigns = context!!.getBean(CampaignService::class.java)
        val first = campaigns.register(RegisterCampaign("Writing A", root.toString())).getOrNull()!!.id
        val second = campaigns.register(RegisterCampaign("Writing B", other.toString())).getOrNull()!!.id
        val writing = context!!.getBean(WritingService::class.java)
        val draft = writing.create(first, CreateDraft("npc", true)).getOrNull()!!
        draft.fields.status shouldBe "draft"
        draft.fields.body shouldContain "## Motivation"
        (draft.id != draft.card) shouldBe true
        val fields = draft.fields.copy(title = "Captain: 'Mira'\n# literal", tags = listOf(" Harbour ", "HARBOUR"), summary = "A captain.", body = "# Mira\r\nExact text\r\n## Secret\r\nHidden")
        val saved = writing.save(first, draft.id, SaveDraft(0, fields)).getOrNull()!!
        saved.revision shouldBe 1
        writing.open(second, draft.id).isLeft() shouldBe true
        writing.save(second, draft.id, SaveDraft(1, fields)).isLeft() shouldBe true
        writing.preview(second, draft.id, fields).isLeft() shouldBe true
        writing.list(second).getOrNull()!!.drafts.isEmpty() shouldBe true
        writing.save(first, draft.id, SaveDraft(0, fields.copy(title = "Stale"))).leftOrNull()!!.code shouldBe "writing.stale-revision"
        val preview = writing.preview(first, draft.id, fields).getOrNull()!!.preview
        preview.classification.metadata!!.title shouldBe fields.title
        preview.classification.metadata!!.tags shouldBe listOf("harbour")
        val incomplete = writing.save(first, draft.id, SaveDraft(1, fields.copy(title = "", summary = "s".repeat(1001)))).getOrNull()!!
        writing.preview(first, draft.id, incomplete.fields).getOrNull()!!.preview.classification.issues.any { it.field == "title" } shouldBe true
        writing.save(first, draft.id, SaveDraft(2, fields.copy(body = "x".repeat(2 * 1024 * 1024 + 1)))).isLeft() shouldBe true
        writing.open(first, draft.id).getOrNull() shouldBe incomplete
        val transactions = context!!.getBean(Transactions::class.java)
        transactions.run<DraftData> {
            writing.save(first, draft.id, SaveDraft(2, fields))
            Either.Left(Failure.Invalid("writing.test-rollback", "rollback"))
        }.isLeft() shouldBe true
        writing.open(first, draft.id).getOrNull() shouldBe incomplete
        context!!.close(); context = start()
        context!!.getBean(WritingService::class.java).open(first, draft.id).getOrNull() shouldBe incomplete
        Files.list(root).use { it.count() } shouldBe 0
    }
    "preview preserves tables and exact local anchors while disabling unsafe and unavailable targets" {
        val writing = context!!.getBean(WritingService::class.java)
        val campaign = context!!.getBean(CampaignService::class.java).list().getOrNull()!!.campaigns.first().id
        val draft = writing.create(campaign, CreateDraft("scene", false)).getOrNull()!!
        val fields = draft.fields.copy(title = "Scene", body = "# Same\n# Same\n[local](#same-1) [missing](npc.md) [unsafe](javascript:alert(1)) [external](https://example.com)\n\n![image](https://example.com/image.png)\n\n<script>bad()</script>\n\n| A | B |\n| - | - |\n| x | y |")
        val preview = writing.preview(campaign, draft.id, fields).getOrNull()!!.preview
        preview.links.first().anchor shouldBe "same-1"
        preview.links[1].unavailable shouldBe true
        preview.links[2].unavailable shouldBe true
        preview.links[3].external shouldBe "https://example.com"
        val html = preview.sections.flatMap { it.blocks }.joinToString { it.html }
        html shouldContain "<table>"
        html.contains("<script>") shouldBe false
        html.contains("<img") shouldBe false
        writing.preview(campaign, draft.id, fields.copy(body = "---\nworkbench: {}\n---\nBody")).getOrNull()!!.preview.classification.issues.any { it.code == "writing.body-envelope" } shouldBe true
        writing.preview(campaign, draft.id, fields.copy(path = "../outside.md")).getOrNull()!!.pathIssues.isNotEmpty() shouldBe true
    }
})
