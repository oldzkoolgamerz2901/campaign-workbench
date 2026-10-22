package workbench

import arrow.core.Either
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
import workbench.playthroughs.application.*
import workbench.playthroughs.domain.PlayWorkspace
import workbench.sessionarchives.application.*
import workbench.sessionarchives.api.*
import workbench.sessionarchives.adapter.web.SessionArchiveReader
import workbench.platform.api.*
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.*

class CardTableIntegrationTest : StringSpec({
    "workspace authority, independent revisions, locked membership and complete archive restore" {
        val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        val root = Files.createTempDirectory("card-table-")
        database.start()
        fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
        var context = start()
        try {
            for (name in listOf("one", "two", "three")) Files.writeString(root.resolve("$name.md"), if (name == "two") "# $name\nCard" else "---\nworkbench:\n  schema: 1\n  id: ${UUID.randomUUID()}\n  title: $name\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# $name\nCard")
            val campaigns = context.getBean(CampaignService::class.java)
            val campaign = campaigns.register(RegisterCampaign("Table", root.toString())).getOrNull()!!.id
            val other = campaigns.register(RegisterCampaign("Other", Files.createDirectory(root.resolve("other")).toString())).getOrNull()!!.id
            val capture = context.getBean(SourceService::class.java).refresh(campaign).getOrNull()!!.capture!!
            var p = context.getBean(PreparationService::class.java)
            var play = context.getBean(Playthroughs::class.java)
            val archives = context.getBean(PortableSessionService::class.java)
            var s = p.create(campaign, CreateSession("Table session", "")).getOrNull()!!
            s = p.add(campaign, s.id, AddSource(s.revision, capture, "one.md", null)).getOrNull()!!
            s = p.add(campaign, s.id, AddSource(s.revision, capture, "two.md", null)).getOrNull()!!
            val first = s.items[0].id; val second = s.items[1].id
            // Export must not initialize unopened workspaces.
            val unopened = archives.manifest(campaign, ExportSessions(listOf(s.id))).getOrNull()!!
            unopened.workspaces.single().workspace shouldBe null
            val unopenedId = archives.restore(other, unopened).getOrNull()!!.sessions.single().id
            context.getBean(WorkspaceTransfers::class.java).snapshot(other, unopenedId).getOrNull() shouldBe null
            var w = play.open(campaign, s.id).getOrNull()!!
            w.active shouldBe listOf(first, second)
            play.open(campaign, s.id).getOrNull() shouldBe w
            play.open(other, s.id).isLeft() shouldBe true
            w = play.save(campaign, s.id, SaveWorkspace(w.revision, listOf(second), listOf(first), first, listOf(second, first))).getOrNull()!!
            w.activeSceneItemId shouldBe first
            w.focusedItemIds shouldBe listOf(second, first) // Used cards may remain focused.
            // Inspection/opening does not change explicit scene/focus, nor does invalid input.
            play.open(campaign, s.id).getOrNull() shouldBe w
            for (bad in listOf(
                SaveWorkspace(w.revision, w.active, w.used, second, w.focusedItemIds), // untyped
                SaveWorkspace(w.revision, w.active, w.used, UUID.randomUUID(), emptyList()),
                SaveWorkspace(w.revision, w.active, w.used, first, listOf(first, first)),
                SaveWorkspace(w.revision, w.active, w.used, first, listOf(UUID.randomUUID())),
                SaveWorkspace(w.revision, w.active, w.used, first, List(4) { UUID.randomUUID() })
            )) {
                play.save(campaign, s.id, bad).isLeft() shouldBe true
                play.open(campaign, s.id).getOrNull() shouldBe w
            }
            p.open(campaign, s.id).getOrNull() shouldBe s // Play does not advance Preparation revision.
            play.save(campaign, s.id, SaveWorkspace(w.revision - 1, w.active, w.used, first, listOf(first))).leftOrNull()!!.code shouldBe "playthroughs.stale-revision"
            for (bad in listOf(SaveWorkspace(w.revision, listOf(first, first), listOf(second), null, emptyList()), SaveWorkspace(w.revision, emptyList(), emptyList(), null, emptyList()), SaveWorkspace(w.revision, listOf(UUID.randomUUID()), listOf(first), null, emptyList()))) {
                play.save(campaign, s.id, bad).isLeft() shouldBe true
                play.open(campaign, s.id).getOrNull() shouldBe w
            }
            s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", "Preparation notes", s.items.reversed().map { ItemNotes(it.id, "") })).getOrNull()!!
            play.open(campaign, s.id).getOrNull() shouldBe w // Prep reorder does not reorder the table.
            s = p.add(campaign, s.id, AddSource(s.revision, capture, "three.md", null)).getOrNull()!!
            val third = s.items.last().id
            // A stale mutation after membership changed must fail, without persisting a partial table.
            play.save(campaign, s.id, SaveWorkspace(w.revision, w.active, w.used, w.activeSceneItemId, w.focusedItemIds)).isLeft() shouldBe true
            w = play.open(campaign, s.id).getOrNull()!!
            w.active shouldBe listOf(third, second); w.used shouldBe listOf(first)
            w.activeSceneItemId shouldBe first
            w.focusedItemIds shouldBe listOf(second, first) // New membership never steals focus.
            w = play.save(campaign, s.id, SaveWorkspace(w.revision, w.active, w.used, first, listOf(second, third, first))).getOrNull()!!
            // Returning a card prepends it, explicitly.
            w = play.save(campaign, s.id, SaveWorkspace(w.revision, listOf(first) + w.active, emptyList(), w.activeSceneItemId, w.focusedItemIds)).getOrNull()!!
            // Removal is lazy reconciliation, also performed by export.
            s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", s.notes, s.items.filter { it.id != second }.map { ItemNotes(it.id, "") })).getOrNull()!!
            val archive = archives.manifest(campaign, ExportSessions(listOf(s.id))).getOrNull()!!
            archive.version shouldBe 7
            archive.workspaces.single().workspace!!.active shouldBe listOf(first, third)
            archive.workspaces.single().workspace!!.activeSceneItemId shouldBe first
            archive.workspaces.single().workspace!!.focusedItemIds shouldBe listOf(third, first)
            val codec = context.getBean(SessionArchiveCodec::class.java)
            codec.readTransfer(codec.writeTransfer(archive)).getOrNull() shouldBe archive
            val before = p.list(other).getOrNull()!!.sessions.size
            val malformed = archive.copy(workspaces = listOf(ArchivedWorkspace(s.id, WorkspaceData(s.id, 0, listOf(first), listOf(first), null, emptyList()))))
            archives.restore(other, malformed).isLeft() shouldBe true
            val savedWorkspace = archive.workspaces.single().workspace!!
            for (bad in listOf(
                savedWorkspace.copy(activeSceneItemId = UUID.randomUUID()),
                savedWorkspace.copy(focusedItemIds = listOf(first, first)),
                savedWorkspace.copy(focusedItemIds = listOf(UUID.randomUUID())),
                savedWorkspace.copy(focusedItemIds = List(4) { first })
            )) archives.restore(other, archive.copy(workspaces = listOf(ArchivedWorkspace(s.id, bad)))).isLeft() shouldBe true
            archives.restore(other, archive.copy(workspaces = emptyList())).isLeft() shouldBe true
            p.list(other).getOrNull()!!.sessions.size shouldBe before
            val imported = archives.restore(other, archive).getOrNull()!!.sessions.single().id
            val copy = p.open(other, imported).getOrNull()!!
            val remap = s.items.map { it.id }.zip(copy.items.map { it.id }).toMap()
            play.open(other, imported).getOrNull()!!.active shouldBe listOf(remap.getValue(first), remap.getValue(third))
            play.open(other, imported).getOrNull()!!.activeSceneItemId shouldBe remap.getValue(first)
            play.open(other, imported).getOrNull()!!.focusedItemIds shouldBe listOf(remap.getValue(third), remap.getValue(first))
            copy.items.map { it.provenance } shouldBe s.items.map { it.provenance }
            copy.items.map { it.id }.intersect(s.items.map { it.id }.toSet()).isEmpty() shouldBe true
            // A late failure in the second module rolls the Preparation import back as well.
            val transfers = context.getBean(WorkspaceTransfers::class.java)
            val failing = object : WorkspaceTransfers by transfers {
                override fun restore(campaign: UUID, session: UUID, workspace: WorkspaceData?): Either<Failure, Unit> {
                    transfers.restore(campaign, session, workspace)
                    return Either.Left(Failure.Invalid("test.restore-failure", "Rollback"))
                }
            }
            val tx = context.getBean(Transactions::class.java)
            val broken = PortableSessionService(context.getBean(PreparationTransfers::class.java), failing, context.getBean(PortableTransfers::class.java), codec,
                context.getBean(ImageProcessor::class.java), tx, context.getBean(workbench.campaigns.api.Campaigns::class.java))
            val count = p.list(other).getOrNull()!!.sessions.size
            broken.restore(other, archive).isLeft() shouldBe true
            p.list(other).getOrNull()!!.sessions.size shouldBe count
            // The campaign lock serializes Prepare mutation and workspace writes on separate threads.
            val locked = CountDownLatch(1); val release = CountDownLatch(1)
            val pool = Executors.newFixedThreadPool(3)
            try {
                val current = play.open(campaign, s.id).getOrNull()!!
                val prepare = pool.submit<SessionData> {
                    tx.run { arrow.core.raise.either {
                        context.getBean(workbench.campaigns.api.Campaigns::class.java).configuration(campaign).bind()
                        locked.countDown(); check(release.await(10, TimeUnit.SECONDS))
                        p.save(campaign, s.id, SaveSession(s.revision, s.title, "", "locked", s.items.filter { it.id != first }.map { ItemNotes(it.id, "") })).bind()
                    } }.getOrNull()!!
                }
                check(locked.await(10, TimeUnit.SECONDS))
                val attempting = CountDownLatch(2)
                val playWrite = pool.submit<Either<Failure, WorkspaceData>> { attempting.countDown(); play.save(campaign, s.id, SaveWorkspace(current.revision, current.active, current.used, current.activeSceneItemId, current.focusedItemIds)) }
                val export = pool.submit<SessionTransfer> { attempting.countDown(); archives.manifest(campaign, ExportSessions(listOf(s.id))).getOrNull()!! }
                check(attempting.await(10, TimeUnit.SECONDS))
                try { playWrite.get(150, TimeUnit.MILLISECONDS); error("Play write bypassed the held campaign lock") } catch (_: TimeoutException) { /* expected lock wait */ }
                try { export.get(150, TimeUnit.MILLISECONDS); error("Archive snapshot bypassed the held campaign lock") } catch (_: TimeoutException) { /* expected lock wait */ }
                release.countDown()
                s = prepare.get(15, TimeUnit.SECONDS)
                playWrite.get(15, TimeUnit.SECONDS).isLeft() shouldBe true
                val exported = export.get(15, TimeUnit.SECONDS)
                exported.sessions.single().notes shouldBe "locked"
                exported.workspaces.single().workspace!!.active shouldBe listOf(third)
                exported.workspaces.single().workspace!!.activeSceneItemId shouldBe null
                exported.workspaces.single().workspace!!.focusedItemIds shouldBe listOf(third)
                play.open(campaign, s.id).getOrNull()!!.active shouldBe listOf(third)
            } finally { release.countDown(); pool.shutdownNow() }
            w = play.open(campaign, s.id).getOrNull()!!
            w = play.save(campaign, s.id, SaveWorkspace(w.revision, w.active, w.used, third, listOf(third))).getOrNull()!!
            context.close(); context = start()
            p = context.getBean(PreparationService::class.java); play = context.getBean(Playthroughs::class.java)
            p.open(campaign, s.id).getOrNull() shouldBe s
            play.open(campaign, s.id).getOrNull()!!.active shouldBe listOf(third)
            play.open(campaign, s.id).getOrNull() shouldBe w
            val reopened = play.open(campaign, s.id).getOrNull()!!
            val cleared = play.save(campaign, s.id, SaveWorkspace(reopened.revision, reopened.active, reopened.used, null, emptyList())).getOrNull()!!
            cleared.activeSceneItemId shouldBe null
            cleared.focusedItemIds shouldBe emptyList()
            val jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate::class.java)
            jdbc.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_schema='preparation' AND table_name='session' AND column_name='card_table'", Long::class.java) shouldBe 0L
            // Strict current-format reader: no silent field removal, coercion or duplicate keys.
            val reader = context.getBean(SessionArchiveReader::class.java)
            val mapper = context.getBean(ObjectMapper::class.java)
            val tree = mapper.valueToTree<ObjectNode>(archive)
            tree.put("version", 6)
            reader.readTransfer(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
            tree.put("version", 7); tree.put("unknown", true)
            reader.readTransfer(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
            reader.readTransfer("{\"version\":7,\"version\":7}".toByteArray()).isLeft() shouldBe true
        } finally { context.close(); database.stop(); root.toFile().deleteRecursively() }
    }
})
