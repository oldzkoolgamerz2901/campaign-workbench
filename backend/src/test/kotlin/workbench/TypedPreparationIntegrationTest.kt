package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.flywaydb.core.Flyway
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.ConfigurableApplicationContext
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.preparation.api.*
import workbench.preparation.application.PreparationService
import workbench.sources.application.SourceService
import java.net.URI
import java.net.http.*
import java.nio.file.Files
import java.security.MessageDigest
import java.sql.DriverManager
import java.util.UUID

private fun typedCard(id: UUID, title: String, type: String, body: String, status: String = "current") =
    "---\nworkbench:\n  schema: 1\n  id: '$id'\n  title: $title\n  type: $type\n  purpose: session\n  status: $status\n  tags: [reef]\n  summary: Authored quick summary.\n---\n$body"
private fun digest(text: String) = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

class TypedPreparationIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("workbench-typed-preparation")
    val destination = Files.createTempDirectory("workbench-typed-import")
    val campaign = UUID.randomUUID()
    val legacySession = UUID.randomUUID()
    val legacyItem = UUID.randomUUID()
    val legacyCapture = UUID.randomUUID()
    val legacyText = "---\nworkbench: old unparsed envelope\n---\n# Before\nLegacy text"
    var context: ConfigurableApplicationContext? = null
    var other = UUID.randomUUID()
    var typedArchive: Archive? = null
    fun service() = context!!.getBean(PreparationService::class.java)
    fun mapper() = context!!.getBean(ObjectMapper::class.java)
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run(
        "--server.port=0", "--spring.datasource.url=${database.jdbcUrl}",
        "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    fun post(campaign: UUID, json: String): HttpResponse<String> {
        val port = (context as WebServerApplicationContext).webServer!!.port
        return HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI("http://127.0.0.1:$port/api/campaigns/$campaign/sessions/import"))
            .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(json)).build(), HttpResponse.BodyHandlers.ofString())
    }
    beforeSpec {
        database.start()
        // Exercise an actual upgrade, rather than just creating the newest schema in an empty DB.
        Flyway.configure().dataSource(database.jdbcUrl, database.username, database.password)
            .defaultSchema("workbench_setup").target("5").load().migrate()
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
            connection.prepareStatement("INSERT INTO campaigns.campaign VALUES (?, ?, ?, ?, ?, 0)").use {
                it.setObject(1, campaign); it.setString(2, "Legacy upgrade"); it.setString(3, root.toString()); it.setString(4, "**/*.md"); it.setString(5, ""); it.executeUpdate()
            }
            connection.prepareStatement("INSERT INTO preparation.session VALUES (?, ?, 7, 'Old session', 'Old objective', 'Old notes')").use {
                it.setObject(1, legacySession); it.setObject(2, campaign); it.executeUpdate()
            }
            connection.prepareStatement("INSERT INTO preparation.item VALUES (?, ?, 0, 'Old item', ?, 'Old item notes', ?, ?, 'missing.md', NULL, ?, ?)").use {
                it.setObject(1, legacyItem); it.setObject(2, legacySession); it.setString(3, legacyText); it.setObject(4, campaign); it.setObject(5, legacyCapture)
                it.setString(6, digest(legacyText)); it.setString(7, digest(legacyText)); it.executeUpdate()
            }
            connection.prepareStatement("INSERT INTO preparation.anchor VALUES (?, 'before', 'before')").use { it.setObject(1, legacyItem); it.executeUpdate() }
        }
        context = start()
        other = context!!.getBean(CampaignService::class.java).register(RegisterCampaign("Destination", destination.toString())).getOrNull()!!.id
    }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively(); destination.toFile().deleteRecursively() }

    "V6 preserves old rows and version 1 imports retain raw legacy rendering without source lookups" {
        val p = service()
        val old = p.open(campaign, legacySession).getOrNull()!!
        old.revision shouldBe 7
        val item = old.items.single()
        item.capturedSource shouldBe null
        item.id shouldBe legacyItem
        item.markdown shouldBe legacyText
        item.provenance.contentHash shouldBe digest(legacyText)
        item.anchors shouldBe mapOf("before" to "before")
        item.notes shouldBe "Old item notes"
        val rendered = p.view(campaign, old.id).getOrNull()!!.items.single().source
        rendered.html shouldContain "old unparsed envelope"
        val v2 = p.export(campaign, ExportSessions(listOf(old.id))).getOrNull()!!
        v2.version shouldBe 3
        val tree = mapper().valueToTree<ObjectNode>(v2)
        tree.put("version", 1)
        (tree.path("sessions")[0].path("items")[0] as ObjectNode).remove("capturedSource")
        (tree.path("sessions")[0].path("items")[0].path("provenance") as ObjectNode).remove(listOf("kind", "authored"))
        val response = post(other, tree.toString())
        response.statusCode() shouldBe 200
        val imported = mapper().readValue(response.body(), SessionList::class.java).sessions.single().id
        val copy = p.open(other, imported).getOrNull()!!
        copy.items.single().capturedSource shouldBe null
        copy.items.single().provenance shouldBe item.provenance
        copy.items.single().markdown shouldBe legacyText
        p.view(other, imported).getOrNull()!!.items.single().source shouldBe rendered
        p.open(campaign, imported).isLeft() shouldBe true
        p.import(other, v2.copy(version = 1)).isRight() shouldBe true // null snapshots are legacy in the application contract
    }

    "typed snapshots and links survive source refactors, notes, restart and portable v3 import" {
        val sources = context!!.getBean(SourceService::class.java)
        val p = service()
        val adventureId = UUID.randomUUID()
        val sceneId = UUID.randomUUID()
        val adventure = "\uFEFF" + typedCard(adventureId, "Expedition", "adventure",
            "# Expedition\n## Quick reference\nOutside quick reference.\n## Run\n[scene](scene.md#same-1) [outside](uncaptured.md)\n### Detail\nNested scene note.\n## Background\nOutside background.").replace("\n", "\r\n")
        Files.writeString(root.resolve("adventure.md"), adventure)
        Files.writeString(root.resolve("scene.md"), typedCard(sceneId, "Reef", "scene", "# Same\nOutside first scene.\n# Same\nCaptured scene prose. [back](adventure.md#run)"))
        Files.writeString(root.resolve("uncaptured.md"), typedCard(UUID.randomUUID(), "Outside", "scene", "# Outside\nDo not follow automatically."))
        val capture = sources.refresh(campaign).getOrNull()!!.capture!!
        val run = sources.document(campaign, capture, "adventure.md").getOrNull()!!.sections.first { it.heading == "Run" }.id
        val second = sources.document(campaign, capture, "scene.md").getOrNull()!!.sections.last().id
        var session = p.create(campaign, CreateSession("Typed session", "Prepare the reef")).getOrNull()!!
        session = p.add(campaign, session.id, AddSource(session.revision, capture, "adventure.md", null)).getOrNull()!!
        session = p.add(campaign, session.id, AddSource(session.revision, capture, "adventure.md", run)).getOrNull()!!
        session = p.add(campaign, session.id, AddSource(session.revision, capture, "scene.md", second)).getOrNull()!!
        val whole = session.items.first()
        whole.markdown shouldBe adventure
        whole.provenance.contentHash shouldBe digest(adventure)
        whole.capturedSource!!.classification.metadata!!.id shouldBe adventureId
        whole.capturedSource!!.classification.metadata!!.summary shouldBe "Authored quick summary."
        whole.capturedSource!!.interpretation shouldBe 1
        val subtree = session.items[1]
        subtree.markdown.contains("Outside quick reference") shouldBe false
        subtree.markdown.contains("Outside background") shouldBe false
        subtree.markdown shouldContain "Nested scene note."
        subtree.capturedSource!!.bodyStart shouldBe 0
        subtree.capturedSource!!.classification shouldBe whole.capturedSource!!.classification
        subtree.capturedSource!!.relationships.size shouldBe 2
        whole.capturedSource!!.relationships.first().classification!!.metadata!!.id shouldBe sceneId
        whole.capturedSource!!.relationships.first().sceneCandidate shouldBe true
        val view = p.view(campaign, session.id).getOrNull()!!
        view.items.first().source.html.contains("workbench:") shouldBe false
        view.items.first().source.anchors.first() shouldBe "expedition"
        view.items.first().source.links.first().target shouldBe "@${session.items.last().id}#same"
        view.items.first().source.links.last().unavailable shouldBe true
        session = p.save(campaign, session.id, SaveSession(session.revision, session.title, session.objective, "Session **notes**",
            session.items.map { ItemNotes(it.id, "Item notes") })).getOrNull()!!
        val saved = session
        // A later capture must never satisfy an old prepared relationship.
        var partial = p.create(campaign, CreateSession("Mixed captures", "")).getOrNull()!!
        partial = p.add(campaign, partial.id, AddSource(partial.revision, capture, "adventure.md", null)).getOrNull()!!
        Files.move(root.resolve("scene.md"), root.resolve("renamed.md"))
        Files.writeString(root.resolve("renamed.md"), typedCard(sceneId, "Renamed label", "scene", "# Replacement\nNew prose", "superseded"))
        Files.writeString(root.resolve("split.md"), typedCard(UUID.randomUUID(), "Split scene", "scene", "# Split\nIndependent prose"))
        Files.writeString(root.resolve("scene.md"), typedCard(UUID.randomUUID(), "New card at the old path", "scene", "# Same\nNew first scene.\n# Same\nNew second scene."))
        Files.writeString(root.resolve("adventure.md"), typedCard(adventureId, "Changed adventure", "reference", "# Changed\nChanged labels and summary."))
        val newer = sources.refresh(campaign).getOrNull()!!.capture!!
        partial = p.add(campaign, partial.id, AddSource(partial.revision, newer, "scene.md", null)).getOrNull()!!
        p.view(campaign, partial.id).getOrNull()!!.items.first().source.links.first().unavailable shouldBe true
        p.open(campaign, saved.id).getOrNull() shouldBe saved
        Files.list(root).use { it.forEach(Files::delete) }
        sources.refresh(campaign).isRight() shouldBe true
        typedArchive = p.export(campaign, ExportSessions(listOf(saved.id))).getOrNull()!!
        typedArchive!!.version shouldBe 3
        val oldWire = mapper().valueToTree<ObjectNode>(typedArchive)
        oldWire.put("version", 2)
        oldWire.path("sessions").forEach { session -> session.path("items").forEach { item ->
            (item.path("provenance") as ObjectNode).remove(listOf("kind", "authored"))
        } }
        post(other, oldWire.toString()).statusCode() shouldBe 200
        val response = post(other, mapper().writeValueAsString(typedArchive))
        response.statusCode() shouldBe 200
        val importedId = mapper().readValue(response.body(), SessionList::class.java).sessions.single().id
        val imported = p.open(other, importedId).getOrNull()!!
        (imported.id != saved.id) shouldBe true
        imported.revision shouldBe 0
        imported.items.zip(saved.items).forEach { (copy, original) ->
            (copy.id != original.id) shouldBe true
            copy.copy(id = original.id) shouldBe original
        }
        p.view(other, importedId).getOrNull()!!.items.first().source.links.first().target shouldBe "@${imported.items.last().id}#same"
        p.view(other, importedId).getOrNull()!!.items.first().source.links.last().unavailable shouldBe true
        p.open(campaign, importedId).isLeft() shouldBe true
        context!!.close(); context = start()
        service().open(campaign, saved.id).getOrNull() shouldBe saved
        service().open(other, importedId).getOrNull() shouldBe imported
        service().view(other, importedId).getOrNull()!!.items.first().source.html.contains("workbench:") shouldBe false
    }

    "versioned wire validation rejects malformed archives atomically before any session is imported" {
        val archive = typedArchive!!
        val originalCount = service().list(other).getOrNull()!!.sessions.size
        fun mutate(change: (ObjectNode, ObjectNode, ObjectNode) -> Unit): String {
            val tree = mapper().valueToTree<ObjectNode>(archive)
            val item = tree.path("sessions")[0].path("items")[0] as ObjectNode
            change(tree, item, item.path("capturedSource") as ObjectNode)
            return tree.toString()
        }
        val invalid = listOf(
            mutate { tree, _, _ -> tree.put("version", "2") },
            mutate { tree, _, _ -> tree.put("version", 99) },
            mutate { tree, _, _ -> tree.put("version", 1) }, // a v1 reader must never silently discard typed fields
            mutate { _, item, _ -> item.remove("capturedSource") },
            mutate { _, _, source -> source.put("interpretation", 2) },
            mutate { _, _, source -> source.put("bodyStart", "10") },
            mutate { _, _, source -> source.put("bodyStart", 1) },
            mutate { _, _, source -> source.put("bodyStart", -1) },
            mutate { _, _, source -> source.put("bodyStart", Int.MAX_VALUE) },
            mutate { _, _, source -> source.put("unexpected", true) },
            mutate { _, _, source -> (source.path("classification").path("metadata") as ObjectNode).put("schema", 99) },
            mutate { _, _, source -> (source.path("classification").path("metadata") as ObjectNode).put("id", "1-1-1-1-1") },
            mutate { _, _, source -> (source.path("classification").path("metadata") as ObjectNode).put("purpose", "guidance") },
            mutate { _, _, source -> (source.path("classification").path("metadata") as ObjectNode).put("summary", "x".repeat(1001)) },
            mutate { _, _, source -> (source.path("relationships")[0] as ObjectNode).put("sceneCandidate", "true") },
            mutate { _, _, source -> (source.path("relationships")[0].path("target") as ObjectNode).put("missing", 0) },
            mutate { _, _, source -> (source.path("relationships")[0].path("classification").path("metadata") as ObjectNode).put("type", "unsupported") },
            mutate { tree, _, _ -> (tree.path("sessions")[0] as ObjectNode).put("revision", 1.5) },
            mutate { _, item, _ -> item.put("markdown", "Tampered") },
            mutate { _, item, _ -> item.put("notes", "x".repeat(2 * 1024 * 1024 + 1)) },
            mapper().writeValueAsString(archive) + "{}",
            mapper().writeValueAsString(archive).replaceFirst("\"version\":3", "\"version\":3,\"version\":1")
        )
        invalid.forEachIndexed { index, json ->
            val response = post(other, json)
            check(response.statusCode() == 400) { "Invalid case $index returned ${response.statusCode()}: ${response.body()}" }
            service().list(other).getOrNull()!!.sessions.size shouldBe originalCount
        }
        // A valid first session and invalid second session must not create the first one.
        val broken = archive.sessions.single().copy(id = UUID.randomUUID(), items = archive.sessions.single().items.map { it.copy(markdown = "Tampered") })
        post(other, mapper().writeValueAsString(archive.copy(sessions = archive.sessions + broken))).statusCode() shouldBe 400
        post(other, mapper().writeValueAsString(archive.copy(sessions = archive.sessions + archive.sessions))).statusCode() shouldBe 400
        post(other, " ".repeat(20 * 1024 * 1024 + 1)).statusCode() shouldBe 400
        service().list(other).getOrNull()!!.sessions.size shouldBe originalCount
    }
    "frozen invalid classifications and expanded Unicode tags remain portable" {
        val sources = context!!.getBean(SourceService::class.java)
        val p = service()
        Files.writeString(root.resolve("unicode.md"), typedCard(UUID.randomUUID(), "Unicode card", "reference", "# Unicode\nReadable prose").replace("tags: [reef]", "tags: ['${"İ".repeat(64)}']"))
        Files.writeString(root.resolve("invalid.md"), "---\nworkbench: [broken\n---\n# Readable\nRetained prose")
        val capture = sources.refresh(campaign).getOrNull()!!.capture!!
        var session = p.create(campaign, CreateSession("Classification portability", "")).getOrNull()!!
        session = p.add(campaign, session.id, AddSource(session.revision, capture, "unicode.md", null)).getOrNull()!!
        session = p.add(campaign, session.id, AddSource(session.revision, capture, "invalid.md", null)).getOrNull()!!
        session.items.first().capturedSource!!.classification.metadata!!.tags.single() shouldBe "i\u0307".repeat(64)
        val invalid = session.items.last().capturedSource!!.classification
        invalid.metadata shouldBe null
        invalid.issues.single().code shouldBe "metadata.yaml"
        val archive = p.export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!
        val response = post(other, mapper().writeValueAsString(archive))
        response.statusCode() shouldBe 200
        val id = mapper().readValue(response.body(), SessionList::class.java).sessions.single().id
        p.open(other, id).getOrNull()!!.items.map { it.capturedSource } shouldBe session.items.map { it.capturedSource }
        val html = p.view(other, id).getOrNull()!!.items.last().source.html
        html shouldContain "Retained prose"
        html.contains("workbench:") shouldBe false
    }
})
