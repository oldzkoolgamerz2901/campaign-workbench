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
import workbench.playthroughs.api.*
import java.nio.file.Files
import java.util.UUID

class RelationshipSuggestionsIntegrationTest : StringSpec({
    "frozen suggestions preserve exact capture, sections, ambiguity and read-only workspace semantics" {
        val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        val root = Files.createTempDirectory("relationship-suggestions-")
        database.start()
        val context = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
        try {
            Files.writeString(root.resolve("scene.md"), "---\nworkbench:\n  schema: 1\n  id: ${UUID.randomUUID()}\n  title: Scene\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# Scene\n[One](npc.md) [Again](./npc.md) [Section](npc.md#history) [Unprepared](extra.md) [Alias](./extra.md) [Guidance](guidance.md) [Missing](missing.md) [Unsafe](javascript:alert) [Remote](https://example.org)")
            Files.writeString(root.resolve("npc.md"), "# NPC\n\n## History\nOld frozen history")
            Files.writeString(root.resolve("extra.md"), "# Extra")
            Files.writeString(root.resolve("guidance.md"), "---\nworkbench:\n  schema: 1\n  id: ${UUID.randomUUID()}\n  title: Guidance\n  type: reference\n  purpose: guidance\n  status: current\n  tags: []\n---\n# Guidance")
            val campaign = context.getBean(CampaignService::class.java).register(RegisterCampaign("Suggestions", root.toString())).getOrNull()!!.id
            val sources = context.getBean(SourceService::class.java)
            val capture = sources.refresh(campaign).getOrNull()!!.capture!!
            val preparation = context.getBean(PreparationService::class.java)
            val play = context.getBean(Playthroughs::class.java)
            val targets = context.getBean(PreparedTargets::class.java)
            var session = preparation.create(campaign, CreateSession("Suggestions", "")).getOrNull()!!
            for (path in listOf("scene.md", "npc.md", "npc.md")) session = preparation.add(campaign, session.id, AddSource(session.revision, capture, path, null)).getOrNull()!!
            val scene = session.items[0].id
            val copies = session.items.drop(1).map { it.id }
            var workspace = play.open(campaign, session.id).getOrNull()!!
            workspace = play.save(campaign, session.id, SaveWorkspace(workspace.revision, listOf(scene, copies[1]), listOf(copies[0]), scene, listOf(copies[0]))).getOrNull()!!
            val initial = play.suggestions(campaign, session.id, scene).getOrNull()!!
            initial.suggestions.size shouldBe 7 // repeated exact full-document target collapsed
            initial.suggestions[0].state shouldBe PreparedTargetState.AMBIGUOUS
            initial.suggestions[0].candidates.map { it.item } shouldBe copies
            initial.suggestions[1].candidates.map { it.item } shouldBe copies
            initial.suggestions[1].candidates.all { it.anchor != null } shouldBe true
            initial.suggestions[2].state shouldBe PreparedTargetState.UNPREPARED
            initial.suggestions.drop(3).all { it.state == PreparedTargetState.UNAVAILABLE } shouldBe true
            targets.candidates(campaign, session.id, scene, "prepared-link-999").isLeft() shouldBe true
            targets.candidates(campaign, session.id, UUID.randomUUID(), "prepared-link-0").isLeft() shouldBe true
            play.suggestions(campaign, session.id, copies[0]).isLeft() shouldBe true
            play.suggestions(UUID.randomUUID(), session.id, scene).isLeft() shouldBe true
            play.open(campaign, session.id).getOrNull() shouldBe workspace
            preparation.open(campaign, session.id).getOrNull() shouldBe session
            // Refresh and prepare a newer copy: it must never replace the scene's frozen target.
            Files.writeString(root.resolve("npc.md"), "# NPC\n\n## History\nChanged live history")
            val newerCapture = sources.refresh(campaign).getOrNull()!!.capture!!
            session = preparation.add(campaign, session.id, AddSource(session.revision, newerCapture, "npc.md", null)).getOrNull()!!
            play.suggestions(campaign, session.id, scene).getOrNull() shouldBe initial
            // Preparation order, not table order, decides exact-copy presentation order.
            session = preparation.save(campaign, session.id, SaveSession(session.revision, session.title, session.objective, session.notes, session.items.reversed().map { ItemNotes(it.id, it.notes) })).getOrNull()!!
            play.suggestions(campaign, session.id, scene).getOrNull()!!.suggestions[0].candidates.map { it.item } shouldBe copies.reversed()
        } finally {
            context.close()
            database.stop()
            root.toFile().deleteRecursively()
        }
    }
})
