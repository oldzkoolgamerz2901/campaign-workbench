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
import workbench.playthroughs.api.Playthroughs
import workbench.playthroughs.api.*
import workbench.preparation.api.CreateSession
import workbench.preparation.application.PreparationService
import workbench.sources.application.SourceService
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.util.UUID

class WorkspaceHttpIntegrationTest : StringSpec({
    "HTTP commands protect the Scene slot, require nullable fields and retire whole-state writes" {
        val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        val root = Files.createTempDirectory("workspace-http-")
        database.start()
        try {
            SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run(
                "--server.port=0", "--spring.datasource.url=${database.jdbcUrl}",
                "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}"
            ).use { context ->
                for (name in listOf("first", "second")) Files.writeString(root.resolve("$name.md"),
                    "---\nworkbench:\n  schema: 1\n  id: ${UUID.randomUUID()}\n  title: $name\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# $name\nFrozen scene")
                val campaign = context.getBean(CampaignService::class.java)
                    .register(RegisterCampaign("Workspace HTTP", root.toString())).getOrNull()!!.id
                val capture = context.getBean(SourceService::class.java).refresh(campaign).getOrNull()!!.capture!!
                val preparation = context.getBean(PreparationService::class.java)
                var session = preparation.create(campaign, CreateSession("Scene contract", "")).getOrNull()!!
                for (name in listOf("first", "second")) session = preparation.addHistoricalSource(context, campaign, session.id,
                    HistoricalSource(session.revision, capture, "$name.md", null)).getOrNull()!!
                val first = session.items[0].id; val second = session.items[1].id
                val play = context.getBean(Playthroughs::class.java)
                val initial = play.open(campaign, session.id).getOrNull()!!
                val mapper = context.getBean(ObjectMapper::class.java)
                val port = (context as WebServerApplicationContext).webServer!!.port
                val client = HttpClient.newHttpClient()
                val base = "http://127.0.0.1:$port"
                val endpoint = "$base/api/campaigns/$campaign/sessions/${session.id}/workspace"
                fun post(suffix: String, body: String) = client.send(HttpRequest.newBuilder(URI("$endpoint/$suffix"))
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString())
                fun scene(revision: Long, item: UUID?) = mapper.writeValueAsString(TransitionScene(revision, session.revision, item))
                post("move", "{\"item\":\"$first\",\"destination\":\"USED\"}").statusCode() shouldBe 400
                post("scene", "{\"revision\":${initial.revision},\"scene\":\"$first\"}").statusCode() shouldBe 400
                post("scene", scene(initial.revision, first)).statusCode() shouldBe 200
                val active = play.open(campaign, session.id).getOrNull()!!
                active.activeSceneItemId shouldBe first
                active.sessionCards shouldBe listOf(second)
                post("move", mapper.writeValueAsString(MoveCard(active.revision, first, CardLocation.USED))).statusCode() shouldBe 400
                post("scene", "{\"revision\":${active.revision},\"preparationRevision\":${session.revision}}").statusCode() shouldBe 400
                post("rename-pile", "{\"revision\":${active.revision},\"pile\":\"PILE_1\"}").statusCode() shouldBe 400
                post("move", "{\"revision\":${active.revision},\"item\":\"$second\",\"destination\":\"ACTIVE_SCENE\"}").statusCode() shouldBe 400
                play.open(campaign, session.id).getOrNull() shouldBe active
                post("scene", scene(active.revision - 1, second)).statusCode() shouldBe 409
                post("scene", scene(active.revision, null)).statusCode() shouldBe 200
                val cleared = play.open(campaign, session.id).getOrNull()!!
                cleared.activeSceneItemId shouldBe null
                cleared.sessionCards shouldBe listOf(first, second)
                post("move", mapper.writeValueAsString(MoveCard(cleared.revision, first, CardLocation.PILE_1))).statusCode() shouldBe 200
                val piled = play.open(campaign, session.id).getOrNull()!!
                post("scene", scene(piled.revision, first)).statusCode() shouldBe 200
                val selected = play.open(campaign, session.id).getOrNull()!!
                selected.pile1.items shouldBe emptyList()
                selected.pile1.cover shouldBe null
                preparation.open(campaign, session.id).getOrNull() shouldBe session
                val retired = client.send(HttpRequest.newBuilder(URI(endpoint)).header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString("{}")).build(), HttpResponse.BodyHandlers.ofString())
                retired.statusCode() shouldBe 405

                val contract = client.send(HttpRequest.newBuilder(URI("$base/v3/api-docs")).GET().build(),
                    HttpResponse.BodyHandlers.ofString())
                contract.statusCode() shouldBe 200
                val paths = mapper.readTree(contract.body()).path("paths")
                for (suffix in listOf("sources", "drafts")) {
                    paths.has("/api/campaigns/{campaign}/sessions/{id}/$suffix") shouldBe false
                    val retired = client.send(HttpRequest.newBuilder(URI("$base/api/campaigns/$campaign/sessions/${session.id}/$suffix"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString("{}")) .build(), HttpResponse.BodyHandlers.ofString())
                    retired.statusCode() shouldBe 404
                    preparation.open(campaign, session.id).getOrNull() shouldBe session
                }
                Files.writeString(java.nio.file.Path.of("build/t1-openapi.json"), contract.body())
                paths.path("/api/campaigns/{campaign}/sessions/{session}/workspace").has("put") shouldBe false
                val schemas = mapper.readTree(contract.body()).path("components").path("schemas")
                schemas.has("SaveWorkspace") shouldBe false
                val schema = schemas.path("TransitionScene")
                val required = mutableSetOf<String>()
                for (field in schema.path("required")) required.add(field.asString())
                required shouldBe setOf("revision", "preparationRevision", "scene")
                val types = mutableSetOf<String>()
                for (type in schema.path("properties").path("scene").path("type")) types.add(type.asString())
                types shouldBe setOf("string", "null")
            }
        } finally { database.stop(); root.toFile().deleteRecursively() }
    }
})
