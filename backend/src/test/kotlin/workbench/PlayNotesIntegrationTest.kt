package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.*
import workbench.campaigns.application.CampaignService
import workbench.sources.application.SourceService
import workbench.preparation.application.PreparationService
import workbench.preparation.api.*
import workbench.playthroughs.api.*
import workbench.playthroughs.application.*
import workbench.sessionarchives.application.*
import workbench.sessionarchives.adapter.web.SessionArchiveReader
import workbench.platform.api.*
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.*
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode

class PlayNotesIntegrationTest : StringSpec({
    "notes preserve captured context, retries, revisions, locked creation and complete archives" {
        val db = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        db.start()
        val root = Files.createTempDirectory("playnotes-")
        val card = UUID.randomUUID()
        Files.writeString(root.resolve("scene.md"), "---\nworkbench:\n  schema: 1\n  id: $card\n  title: Scene\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# Scene\n## Section\nFrozen")
        Files.writeString(root.resolve("plain.md"), "# Untyped\nContext only")
        var c = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${db.jdbcUrl}", "--spring.datasource.username=${db.username}", "--spring.datasource.password=${db.password}")
        try {
            val campaigns = c.getBean(CampaignService::class.java)
            val campaign = campaigns.register(RegisterCampaign("Notes", root.toString())).getOrNull()!!.id
            val other = campaigns.register(RegisterCampaign("Other", Files.createDirectory(root.resolve("other")).toString())).getOrNull()!!.id
            val capture = c.getBean(SourceService::class.java).refresh(campaign).getOrNull()!!.capture!!
            val p = c.getBean(PreparationService::class.java)
            val play = c.getBean(Playthroughs::class.java)
            val notes = c.getBean(PlayNotes::class.java)
            val archives = c.getBean(PortableSessionService::class.java)
            val codec = c.getBean(SessionArchiveReader::class.java)
            val mapper = c.getBean(ObjectMapper::class.java)
            var s = p.create(campaign, CreateSession("Notes", "")).getOrNull()!!
            s = p.addHistoricalSource(c, campaign, s.id, HistoricalSource(s.revision, capture, "scene.md", null)).getOrNull()!!
            val sectionKey = c.getBean(SourceService::class.java).document(campaign, capture, "scene.md").getOrNull()!!.sections.last().id
            s = p.addHistoricalSource(c, campaign, s.id, HistoricalSource(s.revision, capture, "scene.md", sectionKey)).getOrNull()!!
            s = p.addHistoricalSource(c, campaign, s.id, HistoricalSource(s.revision, capture, "plain.md", null)).getOrNull()!!
            val scene = s.items[0].id; val section = s.items[1].id; val plain = s.items[2].id
            var w = play.open(campaign, s.id).getOrNull()!!
            val operation = CreatePlayNote(UUID.randomUUID(), null, "**First**", section)
            val first = notes.create(campaign, s.id, operation).getOrNull()!!
            first.resource!!.reference shouldBe ResourceReference(campaign, card)
            first.scene shouldBe null
            p.open(campaign, s.id).getOrNull() shouldBe s
            notes.create(other, s.id, operation).isLeft() shouldBe true
            w = play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, scene)).getOrNull()!!
            notes.create(campaign, s.id, operation).getOrNull() shouldBe first
            notes.create(campaign, s.id, operation.copy(markdown = "different")).leftOrNull()!!.code shouldBe "playnotes.operation-conflict"
            notes.create(campaign, s.id, operation.copy(operation = UUID.randomUUID())).leftOrNull()!!.code shouldBe "playnotes.scene-context"
            val secondRequest = CreatePlayNote(UUID.randomUUID(), scene, "Second", plain)
            w = play.move(campaign, s.id, MoveCard(w.revision, plain, CardLocation.PILE_1)).getOrNull()!!
            val second = notes.create(campaign, s.id, secondRequest).getOrNull()!!
            second.scene!!.reference shouldBe ResourceReference(campaign, card)
            second.resource!!.reference shouldBe null
            val edited = notes.edit(campaign, s.id, second.id, EditPlayNote(0, "Updated", true, false, null)).getOrNull()!!
            edited.createdAt shouldBe second.createdAt
            edited.revision shouldBe 1
            edited.resource shouldBe second.resource
            notes.edit(campaign, s.id, second.id, EditPlayNote(0, "Lost", false, false, null)).leftOrNull()!!.code shouldBe "playnotes.stale-revision"
            notes.create(campaign, s.id, secondRequest).getOrNull() shouldBe edited
            notes.list(campaign, s.id).getOrNull()!!.notes.map { it.id } shouldBe listOf(second.id, first.id)
            // A capture must wait for the same campaign lock, then see the new Scene context.
            val tx = c.getBean(Transactions::class.java)
            val pool = Executors.newFixedThreadPool(2)
            val locked = CountDownLatch(1); val release = CountDownLatch(1)
            try {
                val transition = pool.submit<WorkspaceData> {
                    tx.run { arrow.core.raise.either {
                        c.getBean(Campaigns::class.java).configuration(campaign).bind()
                        locked.countDown(); check(release.await(10, TimeUnit.SECONDS))
                        play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, null)).bind()
                    } }.getOrNull()!!
                }
                check(locked.await(10, TimeUnit.SECONDS))
                val attempting = CountDownLatch(1)
                val captureNote = pool.submit<Either<Failure, PlayNoteData>> {
                    attempting.countDown(); notes.create(campaign, s.id, secondRequest.copy(operation = UUID.randomUUID()))
                }
                check(attempting.await(10, TimeUnit.SECONDS))
                try { captureNote.get(150, TimeUnit.MILLISECONDS); error("Capture bypassed campaign lock") } catch (_: TimeoutException) { }
                release.countDown(); transition.get(15, TimeUnit.SECONDS)
                captureNote.get(15, TimeUnit.SECONDS).leftOrNull()!!.code shouldBe "playnotes.scene-context"
            } finally { release.countDown(); pool.shutdownNow() }
            notes.edit(campaign, s.id, first.id, EditPlayNote(0, first.markdown, false, true, UUID.randomUUID())).isLeft() shouldBe true
            val correction = notes.edit(campaign, s.id, first.id, EditPlayNote(0, first.markdown, false, true, plain)).getOrNull()!!
            correction.resource!!.reference shouldBe null
            correction.resource!!.title shouldBe s.items.first { it.id == plain }.title
            correction.createdAt shouldBe first.createdAt
            val fullStore = object : PlayNoteStore by c.getBean(PlayNoteStore::class.java) {
                override fun count(session: UUID) = 10000L
            }
            val fullService = PlayNoteService(c.getBean(Campaigns::class.java), c.getBean(PreparedSessions::class.java), play, fullStore, tx)
            fullService.create(campaign, s.id, CreatePlayNote(UUID.randomUUID(), null, "Over limit", null)).isLeft() shouldBe true
            val validations = c.getBean(PlayNoteTransfers::class.java)
            validations.validate(List(10001) { first }, campaign, s.id) shouldBe false
            validations.validate(listOf(first, first), campaign, s.id) shouldBe false
            validations.validate(listOf(first.copy(markdown = "é".repeat(1024 * 1024 + 1))), campaign, s.id) shouldBe false
            notes.create(campaign, s.id, CreatePlayNote(UUID.randomUUID(), null, " ", null)).isLeft() shouldBe true
            // Concurrent identical operation IDs serialize and return one record.
            val retryPool = Executors.newFixedThreadPool(2)
            val concurrent = CreatePlayNote(UUID.randomUUID(), null, "Concurrent", null)
            try {
                val results = List(2) { retryPool.submit<PlayNoteData> { notes.create(campaign, s.id, concurrent).getOrNull()!! } }.map { it.get(15, TimeUnit.SECONDS) }
                results[0] shouldBe results[1]
            } finally { retryPool.shutdownNow() }
            // Duplicate declared metadata retains title context without fabricated identity.
            Files.writeString(root.resolve("duplicate.md"), Files.readString(root.resolve("scene.md")))
            val duplicateCapture = c.getBean(SourceService::class.java).refresh(campaign).getOrNull()!!.capture!!
            s = p.addHistoricalSource(c, campaign, s.id, HistoricalSource(s.revision, duplicateCapture, "duplicate.md", null)).getOrNull()!!
            val duplicate = notes.create(campaign, s.id, CreatePlayNote(UUID.randomUUID(), null, "Duplicate context", s.items.last().id)).getOrNull()!!
            duplicate.resource!!.reference shouldBe null
            // Removing resources and changing live files cannot rewrite recorded evidence.
            s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", "Preparation remains separate", s.items.filter { it.id != plain }.map { ItemNotes(it.id, "") })).getOrNull()!!
            Files.delete(root.resolve("scene.md")); c.getBean(SourceService::class.java).refresh(campaign)
            notes.list(campaign, s.id).getOrNull()!!.notes.first { it.id == edited.id } shouldBe edited
            val archive = archives.manifest(campaign, ExportSessions(listOf(s.id))).getOrNull()!!
            archive.version shouldBe 10
            codec.readTransfer(codec.writeTransfer(archive)).getOrNull() shouldBe archive
            val restoredId = archives.restore(other, archive).getOrNull()!!.sessions.single().id
            val restored = notes.list(other, restoredId).getOrNull()!!.notes
            restored.map { it.markdown } shouldBe listOf("Duplicate context", "Concurrent", "Updated", "**First**")
            val restoredSecond = restored.first { it.markdown == "Updated" }
            restoredSecond.scene shouldBe second.scene
            restoredSecond.resource shouldBe second.resource
            restoredSecond.createdAt shouldBe second.createdAt
            restoredSecond.revision shouldBe 0
            restoredSecond.pinned shouldBe true
            (restoredSecond.id != second.id) shouldBe true
            // An imported session has no source retry IDs; an old operation is a fresh create.
            notes.create(other, restoredId, operation.copy(resource = null)).isRight() shouldBe true
            fun invalid(change: (ObjectNode) -> Unit) {
                val tree = mapper.readTree(codec.writeTransfer(archive)) as ObjectNode
                change(tree); codec.readTransfer(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
            }
            invalid { it.put("version", 9) }
            invalid { (it.path("notes")[0] as ObjectNode).put("pinned", "true") }
            invalid { (it.path("notes")[0] as ObjectNode).remove("scene") }
            invalid { (it.path("notes")[0] as ObjectNode).put("createdAt", "not-time") }
            invalid { (it.path("notes")[2].path("scene").path("reference") as ObjectNode).put("card", "bad") }
            invalid { val array = it.putArray("notes"); repeat(10001) { array.addNull() } }
            val tied = archive.notes.take(2).map { it.copy(createdAt = first.createdAt) }
            val tiedId = archives.restore(other, archive.copy(notes = tied)).getOrNull()!!.sessions.single().id
            val tieNotes = notes.list(other, tiedId).getOrNull()!!.notes
            tieNotes.map { it.id.toString() } shouldBe tieNotes.map { it.id.toString() }.sortedDescending()
            val count = p.list(other).getOrNull()!!.sessions.size
            archives.restore(other, archive.copy(notes = archive.notes.map { it.copy(session = UUID.randomUUID()) })).isLeft() shouldBe true
            archives.restore(other, archive.copy(notes = archive.notes.map { it.copy(campaign = other) })).isLeft() shouldBe true
            p.list(other).getOrNull()!!.sessions.size shouldBe count
            val failingNotes = object : PlayNoteTransfers by c.getBean(PlayNoteTransfers::class.java) {
                override fun restore(campaign: UUID, session: UUID, notes: List<PlayNoteData>): Either<Failure, Unit> = Either.Left(Failure.Invalid("test.fail", "Late restore failure"))
            }
            val broken = PortableSessionService(c.getBean(PreparationTransfers::class.java), c.getBean(WorkspaceTransfers::class.java), c.getBean(PortableTransfers::class.java), codec, c.getBean(ImageProcessor::class.java), tx, c.getBean(Campaigns::class.java), failingNotes)
            broken.restore(other, archive).isLeft() shouldBe true
            p.list(other).getOrNull()!!.sessions.size shouldBe count
            val expectedAfterRestart = notes.list(other, restoredId).getOrNull()!!
            c.close()
            c = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${db.jdbcUrl}", "--spring.datasource.username=${db.username}", "--spring.datasource.password=${db.password}")
            c.getBean(PlayNotes::class.java).list(other, restoredId).getOrNull() shouldBe expectedAfterRestart
        } finally { c.close(); db.stop(); root.toFile().deleteRecursively() }
    }
})
