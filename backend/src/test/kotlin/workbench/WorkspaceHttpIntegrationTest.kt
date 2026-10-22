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
import workbench.playthroughs.api.SaveWorkspace
import workbench.preparation.api.AddSource
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
    "HTTP workspace saves require the scene field while explicit null clears only the scene" {
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
                for (name in listOf("first", "second")) session = preparation.add(campaign, session.id,
                    AddSource(session.revision, capture, "$name.md", null)).getOrNull()!!
                val first = session.items[0].id; val second = session.items[1].id
                val play = context.getBean(Playthroughs::class.java)
                val initial = play.open(campaign, session.id).getOrNull()!!
                val mapper = context.getBean(ObjectMapper::class.java)
                val port = (context as WebServerApplicationContext).webServer!!.port
                val client = HttpClient.newHttpClient()
                val base = "http://127.0.0.1:$port"
                val endpoint = "$base/api/campaigns/$campaign/sessions/${session.id}/workspace"
                fun put(body: ObjectNode) = client.send(HttpRequest.newBuilder(URI(endpoint))
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(),
                    HttpResponse.BodyHandlers.ofString())
                fun body(revision: Long, scene: UUID?) = mapper.valueToTree<ObjectNode>(
                    SaveWorkspace(revision, listOf(second), listOf(first), scene, listOf(second, first)))

                // Activate a Used Scene through the real HTTP binding, preserving focus order.
                put(body(initial.revision, first)).statusCode() shouldBe 200
                val active = play.open(campaign, session.id).getOrNull()!!
                active.activeSceneItemId shouldBe first
                active.focusedItemIds shouldBe listOf(second, first)
                active.revision shouldBe initial.revision + 1
                val omitted = body(active.revision, first).also { it.remove("activeSceneItemId") }
                val rejected = put(omitted)
                rejected.statusCode() shouldBe 400
                (rejected.headers().firstValue("Content-Type").orElse("").substringBefore(';') in setOf("application/json", "application/problem+json")) shouldBe true
                mapper.readTree(rejected.body()).path("code").asString() shouldBe "request.invalid"
                play.open(campaign, session.id).getOrNull() shouldBe active
                preparation.open(campaign, session.id).getOrNull() shouldBe session

                put(body(active.revision, null)).statusCode() shouldBe 200
                val cleared = play.open(campaign, session.id).getOrNull()!!
                cleared shouldBe active.copy(revision = active.revision + 1, activeSceneItemId = null)
                put(body(cleared.revision, second)).statusCode() shouldBe 200
                val selected = play.open(campaign, session.id).getOrNull()!!
                selected shouldBe cleared.copy(revision = cleared.revision + 1, activeSceneItemId = second)
                preparation.open(campaign, session.id).getOrNull() shouldBe session

                val contract = client.send(HttpRequest.newBuilder(URI("$base/v3/api-docs")).GET().build(),
                    HttpResponse.BodyHandlers.ofString())
                contract.statusCode() shouldBe 200
                val schema = mapper.readTree(contract.body()).path("components").path("schemas").path("SaveWorkspace")
                val required = mutableSetOf<String>()
                for (field in schema.path("required")) required.add(field.asString())
                required.contains("activeSceneItemId") shouldBe true
                val sceneTypes = mutableSetOf<String>()
                for (type in schema.path("properties").path("activeSceneItemId").path("type")) sceneTypes.add(type.asString())
                sceneTypes shouldBe setOf("string", "null")
            }
        } finally { database.stop(); root.toFile().deleteRecursively() }
    }
})
