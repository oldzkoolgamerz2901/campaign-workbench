package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.sources.application.SourceService
import workbench.preparation.application.PreparationService
import workbench.preparation.api.*
import workbench.playthroughs.api.*
import workbench.sessionarchives.application.PortableSessionService
import workbench.sessionarchives.adapter.web.SessionArchiveReader
import java.nio.file.Files
import java.net.URI
import java.net.http.*
import java.util.UUID

class RelationshipSuggestionsIntegrationTest : StringSpec({
    "session associations validate exact endpoints, survive saves and restart, drive read-only Play and remap strict archives" {
        val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        val root = Files.createTempDirectory("scene-associations-")
        database.start()
        fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
        var context = start()
        try {
            for (name in listOf("scene", "other")) Files.writeString(root.resolve("$name.md"), "---\nworkbench:\n  schema: 1\n  id: ${UUID.randomUUID()}\n  title: $name\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# $name\n[NPC](npc.md#history) [Missing](missing.md)")
            Files.writeString(root.resolve("npc.md"), "# NPC\n\n## History\nOld frozen history")
            val campaign = context.getBean(CampaignService::class.java).register(RegisterCampaign("Associations", root.toString())).getOrNull()!!.id
            val other = context.getBean(CampaignService::class.java).register(RegisterCampaign("Other", Files.createDirectory(root.resolve("elsewhere")).toString())).getOrNull()!!.id
            val capture = context.getBean(SourceService::class.java).refresh(campaign).getOrNull()!!.capture!!
            var p = context.getBean(PreparationService::class.java)
            var play = context.getBean(Playthroughs::class.java)
            var s = p.create(campaign, CreateSession("Associations", "")).getOrNull()!!
            for (path in listOf("scene.md", "npc.md", "npc.md", "other.md")) s = p.addHistoricalSource(context, campaign, s.id, HistoricalSource(s.revision, capture, path, null)).getOrNull()!!
            val (scene, first, second, another) = s.items.map { it.id }
            val foreign = p.create(campaign, CreateSession("Foreign", "")).getOrNull()!!
            val foreignItem = p.addHistoricalSource(context, campaign, foreign.id, HistoricalSource(0, capture, "npc.md", null)).getOrNull()!!.items.single().id
            // Frozen hyperlinks never seed contextual edges and retain exact section resolution.
            play.suggestions(campaign, s.id, scene).getOrNull()!!.suggestions shouldBe emptyList()
            p.view(campaign, s.id).getOrNull()!!.items.first().source.links.first().target shouldBe "@$first#history"
            for ((origin, target) in listOf(first to scene, scene to foreignItem, foreignItem to first, scene to UUID.randomUUID())) {
                p.association(campaign, s.id, origin, target, ChangeSceneAssociation(s.revision, true)).isLeft() shouldBe true
                p.open(campaign, s.id).getOrNull() shouldBe s
            }
            p.association(other, s.id, scene, first, ChangeSceneAssociation(s.revision, true)).isLeft() shouldBe true
            for ((origin, target) in listOf(scene to second, scene to first, another to first)) s = p.association(campaign, s.id, origin, target, ChangeSceneAssociation(s.revision, true)).getOrNull()!!
            s.sceneLinks shouldBe listOf(SceneAssociation(scene, first), SceneAssociation(scene, second), SceneAssociation(another, first))
            p.association(campaign, s.id, scene, first, ChangeSceneAssociation(s.revision - 1, false)).leftOrNull()!!.code shouldBe "preparation.stale-revision"
            s = p.association(campaign, s.id, scene, first, ChangeSceneAssociation(s.revision, true)).getOrNull()!!
            s.sceneLinks.size shouldBe 3
            var workspace = play.open(campaign, s.id).getOrNull()!!
            workspace = play.move(campaign, s.id, MoveCard(workspace.revision, first, CardLocation.USED)).getOrNull()!!
            workspace = play.transition(campaign, s.id, TransitionScene(workspace.revision, s.revision, scene)).getOrNull()!!
            val initial = play.suggestions(campaign, s.id, scene).getOrNull()!!
            initial.suggestions.flatMap { it.candidates }.map { it.item } shouldBe listOf(first, second)
            initial.suggestions.all { it.state == PreparedTargetState.MATCHED && it.candidates.single().anchor == null } shouldBe true
            play.open(campaign, s.id).getOrNull() shouldBe workspace
            p.open(campaign, s.id).getOrNull() shouldBe s
            p.removalImpact(campaign, s.id, first).getOrNull()!!.scenes.map { it.title } shouldBe listOf("scene", "other")
            repeat(2) { s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", "notes", s.items.reversed().map { ItemNotes(it.id, "retained") })).getOrNull()!! }
            play.suggestions(campaign, s.id, scene).getOrNull() shouldBe initial
            s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", "notes", s.items.reversed().map { ItemNotes(it.id, it.notes) })).getOrNull()!!
            play.suggestions(campaign, s.id, scene).getOrNull()!!.suggestions.flatMap { it.candidates }.map { it.item } shouldBe listOf(second, first)
            val port = (context as WebServerApplicationContext).webServer!!.port
            val mapper = context.getBean(ObjectMapper::class.java)
            val client = HttpClient.newHttpClient()
            fun http(suffix: String, body: String? = null): HttpResponse<String> {
                val builder = HttpRequest.newBuilder(URI("http://127.0.0.1:$port/api/campaigns/$campaign/sessions/${s.id}/$suffix")).header("Content-Type", "application/json")
                if (body != null) builder.PUT(HttpRequest.BodyPublishers.ofString(body))
                return client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
            }
            val impact = http("items/$first/removal-impact")
            impact.statusCode() shouldBe 200
            mapper.readTree(impact.body()).path("revision").longValue() shouldBe s.revision
            http("scene-links/$scene/$first", "{\"revision\":${s.revision - 1},\"linked\":false}").statusCode() shouldBe 409
            http("scene-links/$first/$scene", "{\"revision\":${s.revision},\"linked\":true}").statusCode() shouldBe 400
            val archives = context.getBean(PortableSessionService::class.java)
            val archive = archives.manifest(campaign, ExportSessions(listOf(s.id, foreign.id))).getOrNull()!!
            archive.version shouldBe 9
            archive.workspaces.last().workspace shouldBe null
            val reader = context.getBean(SessionArchiveReader::class.java)
            reader.readTransfer(reader.writeTransfer(archive)).getOrNull() shouldBe archive
            val before = p.list(other).getOrNull()!!.sessions.size
            val record = archive.sessions.first()
            for (edges in listOf(record.sceneLinks + record.sceneLinks.first(), listOf(SceneAssociation(scene, foreignItem)), listOf(SceneAssociation(first, scene)), List(10001) { SceneAssociation(scene, first) })) {
                archives.restore(other, archive.copy(sessions = listOf(record.copy(sceneLinks = edges), archive.sessions.last()))).isLeft() shouldBe true
                p.list(other).getOrNull()!!.sessions.size shouldBe before
            }
            for (version in 1..8) reader.readTransfer(mapper.writeValueAsBytes(mapper.valueToTree<ObjectNode>(archive).put("version", version))).isLeft() shouldBe true
            for (bad in listOf("missing", "unknown", "uuid", "null")) {
                val tree = mapper.valueToTree<ObjectNode>(archive)
                val sessionNode = tree.path("sessions")[0] as ObjectNode
                when (bad) {
                    "missing" -> sessionNode.remove("sceneLinks")
                    "unknown" -> (sessionNode.path("sceneLinks")[0] as ObjectNode).put("extra", true)
                    "uuid" -> (sessionNode.path("sceneLinks")[0] as ObjectNode).put("item", "invalid")
                    else -> sessionNode.putNull("sceneLinks")
                }
                reader.readTransfer(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
            }
            val imported = archives.restore(other, archive).getOrNull()!!
            val copy = p.open(other, imported.sessions.first().id).getOrNull()!!
            val remap = s.items.map { it.id }.zip(copy.items.map { it.id }).toMap()
            copy.sceneLinks shouldBe s.sceneLinks.map { SceneAssociation(remap.getValue(it.scene), remap.getValue(it.item)) }
            copy.items.map { it.provenance } shouldBe s.items.map { it.provenance }
            copy.items.none { it.id in remap.keys } shouldBe true
            val copiedWorkspace = play.open(other, copy.id).getOrNull()!!
            copiedWorkspace.used shouldBe listOf(remap.getValue(first))
            copiedWorkspace.sessionCards shouldBe listOf(remap.getValue(second), remap.getValue(another))
            copiedWorkspace.activeSceneItemId shouldBe remap.getValue(scene)
            context.getBean(WorkspaceTransfers::class.java).snapshot(other, imported.sessions.last().id).getOrNull() shouldBe null
            context.close(); context = start()
            p = context.getBean(PreparationService::class.java); play = context.getBean(Playthroughs::class.java)
            p.open(campaign, s.id).getOrNull() shouldBe s
            p.open(other, copy.id).getOrNull() shouldBe copy
            play.open(campaign, s.id).getOrNull() shouldBe workspace
            s = p.association(campaign, s.id, scene, second, ChangeSceneAssociation(s.revision, false)).getOrNull()!!
            s.sceneLinks.size shouldBe 2
            s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", s.notes, s.items.filter { it.id != first }.map { ItemNotes(it.id, it.notes) })).getOrNull()!!
            s.sceneLinks shouldBe emptyList()
            play.open(campaign, s.id).getOrNull()!!.used shouldBe emptyList()
            play.open(campaign, s.id).getOrNull()!!.activeSceneItemId shouldBe scene
            s = p.association(campaign, s.id, scene, another, ChangeSceneAssociation(s.revision, true)).getOrNull()!!
            s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", s.notes, s.items.filter { it.id != scene }.map { ItemNotes(it.id, it.notes) })).getOrNull()!!
            s.sceneLinks shouldBe emptyList()
            play.open(campaign, s.id).getOrNull()!!.activeSceneItemId shouldBe null
        } finally { context.close(); database.stop(); root.toFile().deleteRecursively() }
    }
})
