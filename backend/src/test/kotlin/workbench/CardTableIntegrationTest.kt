package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.sources.application.SourceService
import workbench.preparation.application.PreparationService
import workbench.preparation.api.*
import workbench.preparation.adapter.web.SessionArchiveReader
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import java.nio.file.Files
import java.util.UUID

class CardTableIntegrationTest : StringSpec({
    "table state persists independently, reconciles membership and imports remapped IDs" {
        val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        val root = Files.createTempDirectory("card-table-")
        database.start()
        fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
        var context = start()
        try {
            Files.writeString(root.resolve("one.md"), "# One\nFirst card")
            Files.writeString(root.resolve("two.md"), "# Two\nSecond card")
            Files.writeString(root.resolve("three.md"), "# Three\nThird card")
            val campaign = context.getBean(CampaignService::class.java).register(RegisterCampaign("Table", root.toString())).getOrNull()!!.id
            val capture = context.getBean(SourceService::class.java).refresh(campaign).getOrNull()!!.capture!!
            var p = context.getBean(PreparationService::class.java)
            var s = p.create(campaign, CreateSession("Table session", "")).getOrNull()!!
            s = p.add(campaign, s.id, AddSource(s.revision, capture, "one.md", null)).getOrNull()!!
            s = p.add(campaign, s.id, AddSource(s.revision, capture, "two.md", null)).getOrNull()!!
            s.table shouldBe null
            val first = s.items[0].id
            val second = s.items[1].id
            fun save(table: CardTableData?, items: List<PreparedItemData> = s.items) = p.save(campaign, s.id,
                SaveSession(s.revision, s.title, s.objective, s.notes, items.map { ItemNotes(it.id, it.notes) }, table))
            s = save(CardTableData(listOf(second), listOf(first))).getOrNull()!!
            s.items.map { it.id } shouldBe listOf(first, second)
            val stale = s.revision
            s = save(s.table, s.items.reversed()).getOrNull()!!
            s.table shouldBe CardTableData(listOf(second), listOf(first))
            p.save(campaign, s.id, SaveSession(stale, s.title, "", "", s.items.map { ItemNotes(it.id, "") }, s.table)).leftOrNull()!!.code shouldBe "preparation.stale-revision"
            save(CardTableData(listOf(first, first), listOf(second))).isLeft() shouldBe true
            save(CardTableData(listOf(UUID.randomUUID()), emptyList())).isLeft() shouldBe true
            save(CardTableData(emptyList(), emptyList())).isLeft() shouldBe true
            s = p.add(campaign, s.id, AddSource(s.revision, capture, "three.md", null)).getOrNull()!!
            val third = s.items.last().id
            s.table shouldBe CardTableData(listOf(third, second), listOf(first))
            // Omitted table means preserve/reconcile, including existing clients deleting an entry.
            s = save(null, s.items.filter { it.id != second }).getOrNull()!!
            s.table shouldBe CardTableData(listOf(third), listOf(first))
            context.close(); context = start(); p = context.getBean(PreparationService::class.java)
            p.open(campaign, s.id).getOrNull() shouldBe s
            val archive = p.export(campaign, ExportSessions(listOf(s.id))).getOrNull()!!
            archive.version shouldBe 4
            val mapper = context.getBean(ObjectMapper::class.java)
            val reader = context.getBean(SessionArchiveReader::class.java)
            reader.read(mapper.writeValueAsBytes(archive)).getOrNull() shouldBe archive
            val malformed = archive.copy(sessions = listOf(s.copy(table = CardTableData(listOf(third), listOf(third)))))
            val count = p.list(campaign).getOrNull()!!.sessions.size
            p.import(campaign, malformed).isLeft() shouldBe true
            p.list(campaign).getOrNull()!!.sessions.size shouldBe count
            val copyId = p.import(campaign, archive).getOrNull()!!.sessions.single().id
            val copy = p.open(campaign, copyId).getOrNull()!!
            copy.table!!.active shouldBe listOf(copy.items.last().id)
            copy.table!!.used shouldBe listOf(copy.items.first().id)
            (copy.items.map { it.id }.intersect(s.items.map { it.id }.toSet()).isEmpty()) shouldBe true
            val old = mapper.valueToTree<ObjectNode>(archive)
            old.put("version", 3)
            (old.path("sessions")[0] as ObjectNode).remove("table")
            val v3 = reader.read(mapper.writeValueAsBytes(old)).getOrNull()!!
            v3.sessions.single().table shouldBe null
            val oldId = p.import(campaign, v3).getOrNull()!!.sessions.single().id
            p.open(campaign, oldId).getOrNull()!!.table shouldBe null
        } finally {
            context.close(); database.stop(); root.toFile().deleteRecursively()
        }
    }
})
