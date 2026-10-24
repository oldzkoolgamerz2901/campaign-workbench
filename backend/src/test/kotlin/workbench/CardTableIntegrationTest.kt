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
            s = p.addHistoricalSource(context, campaign, s.id, HistoricalSource(s.revision, capture, "one.md", null)).getOrNull()!!
            s = p.addHistoricalSource(context, campaign, s.id, HistoricalSource(s.revision, capture, "two.md", null)).getOrNull()!!
            val first = s.items[0].id; val second = s.items[1].id
            // Export must not initialize unopened workspaces.
            val unopened = archives.manifest(campaign, ExportSessions(listOf(s.id))).getOrNull()!!
            unopened.workspaces.single().workspace shouldBe null
            val unopenedId = archives.restore(other, unopened).getOrNull()!!.sessions.single().id
            context.getBean(WorkspaceTransfers::class.java).snapshot(other, unopenedId).getOrNull() shouldBe null
            var w = play.open(campaign, s.id).getOrNull()!!
            w.sessionCards shouldBe listOf(first, second)
            play.open(campaign, s.id).getOrNull() shouldBe w
            play.open(other, s.id).isLeft() shouldBe true
            w = play.move(campaign, s.id, MoveCard(w.revision, first, CardLocation.USED)).getOrNull()!!
            w = play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, first)).getOrNull()!!
            w.activeSceneItemId shouldBe first
            w.used shouldBe emptyList()
            w.sessionCards shouldBe listOf(second)
            play.move(campaign, s.id, MoveCard(w.revision, first, CardLocation.USED)).isLeft() shouldBe true
            play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, second)).isLeft() shouldBe true
            play.move(campaign, s.id, MoveCard(w.revision - 1, second, CardLocation.USED)).leftOrNull()!!.code shouldBe "playthroughs.stale-revision"
            play.move(campaign, s.id, MoveCard(w.revision, second, CardLocation.PILE_1, -1)).isLeft() shouldBe true
            play.reorder(campaign, s.id, ReorderCards(w.revision, CardLocation.SESSION_CARDS, listOf(second, second))).isLeft() shouldBe true
            play.open(campaign, s.id).getOrNull() shouldBe w
            p.open(campaign, s.id).getOrNull() shouldBe s
            val overview = play.overview(campaign, s.id, first).getOrNull()!!
            s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", "Preparation notes", s.items.reversed().map { ItemNotes(it.id, "") })).getOrNull()!!
            play.transition(campaign, s.id, TransitionScene(w.revision, overview.preparationRevision, first)).leftOrNull()!!.code shouldBe "playthroughs.stale-scene-context"
            play.open(campaign, s.id).getOrNull() shouldBe w
            s = p.addHistoricalSource(context, campaign, s.id, HistoricalSource(s.revision, capture, "three.md", null)).getOrNull()!!
            val third = s.items.last().id
            play.move(campaign, s.id, MoveCard(w.revision, second, CardLocation.USED)).isLeft() shouldBe true
            w = play.open(campaign, s.id).getOrNull()!!
            w.sessionCards shouldBe listOf(third, second)
            w.activeSceneItemId shouldBe first
            s = p.association(campaign, s.id, first, third, ChangeSceneAssociation(s.revision, true)).getOrNull()!!
            val staleOverview = play.overview(campaign, s.id, first).getOrNull()!!
            val associationLocked = CountDownLatch(1); val associationRelease = CountDownLatch(1)
            val associationPool = Executors.newFixedThreadPool(2)
            try {
                val change = associationPool.submit<SessionData> {
                    context.getBean(Transactions::class.java).run { arrow.core.raise.either {
                        context.getBean(workbench.campaigns.api.Campaigns::class.java).configuration(campaign).bind()
                        associationLocked.countDown(); check(associationRelease.await(10, TimeUnit.SECONDS))
                        p.association(campaign, s.id, first, third, ChangeSceneAssociation(s.revision, false)).bind()
                    } }.getOrNull()!!
                }
                check(associationLocked.await(10, TimeUnit.SECONDS))
                val attempting = CountDownLatch(1)
                val confirmation = associationPool.submit<Either<Failure, WorkspaceData>> {
                    attempting.countDown()
                    play.transition(campaign, s.id, TransitionScene(w.revision, staleOverview.preparationRevision, first,
                        listOf(SceneMovement(third, CardLocation.PILE_1))))
                }
                check(attempting.await(10, TimeUnit.SECONDS))
                try { confirmation.get(150, TimeUnit.MILLISECONDS); error("Scene confirmation bypassed Preparation lock") } catch (_: TimeoutException) { }
                associationRelease.countDown()
                s = change.get(15, TimeUnit.SECONDS)
                confirmation.get(15, TimeUnit.SECONDS).leftOrNull()!!.code shouldBe "playthroughs.stale-scene-context"
                play.open(campaign, s.id).getOrNull() shouldBe w
            } finally { associationRelease.countDown(); associationPool.shutdownNow() }
            s = p.association(campaign, s.id, first, third, ChangeSceneAssociation(s.revision, true)).getOrNull()!!
            w = play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, first,
                listOf(SceneMovement(third, CardLocation.PILE_1)))).getOrNull()!!
            w = play.move(campaign, s.id, MoveCard(w.revision, second, CardLocation.PILE_1)).getOrNull()!!
            w.pile1.items shouldBe listOf(third, second)
            w.pile1.cover shouldBe third
            w = play.cover(campaign, s.id, ChooseCover(w.revision, PileSlot.PILE_1, second)).getOrNull()!!
            w = play.reorder(campaign, s.id, ReorderCards(w.revision, CardLocation.PILE_1, listOf(second, third))).getOrNull()!!
            w.pile1.cover shouldBe second
            w = play.rename(campaign, s.id, RenamePile(w.revision, PileSlot.PILE_1, "Enemies")).getOrNull()!!
            play.rename(campaign, s.id, RenamePile(w.revision, PileSlot.PILE_1, " ")).isLeft() shouldBe true
            play.rename(campaign, s.id, RenamePile(w.revision, PileSlot.PILE_1, "x".repeat(201))).isLeft() shouldBe true
            // Keep piles while activating a Scene from Pile 2 removes only that Scene.
            w = play.move(campaign, s.id, MoveCard(w.revision, third, CardLocation.PILE_2)).getOrNull()!!
            w = play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, third)).getOrNull()!!
            w.sessionCards shouldBe listOf(first)
            w.pile1.items shouldBe listOf(second)
            w.pile1.cover shouldBe second
            w.pile2.items shouldBe emptyList()
            w.pile2.cover shouldBe null
            w = play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, null)).getOrNull()!!
            w.sessionCards shouldBe listOf(third, first)
            w.pile1.items shouldBe listOf(second)
            w = play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, first,
                listOf(SceneMovement(third, CardLocation.PILE_1)))).getOrNull()!!
            w.pile1.items shouldBe listOf(second, third)
            // A late invalid index after a valid movement rolls the complete transition back.
            play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, first,
                listOf(SceneMovement(second, CardLocation.PILE_2), SceneMovement(third, CardLocation.PILE_2, 9)))).isLeft() shouldBe true
            play.open(campaign, s.id).getOrNull() shouldBe w
            // A successful customized transition moves existing cards atomically.
            w = play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, first,
                listOf(SceneMovement(second, CardLocation.PILE_2)))).getOrNull()!!
            w.pile1.cover shouldBe third
            w.pile2.cover shouldBe second
            w = play.move(campaign, s.id, MoveCard(w.revision, second, CardLocation.USED)).getOrNull()!!
            w = play.move(campaign, s.id, MoveCard(w.revision, second, CardLocation.PILE_1, 0)).getOrNull()!!
            w.pile1.items shouldBe listOf(second, third)
            w.pile1.cover shouldBe third
            w = play.cover(campaign, s.id, ChooseCover(w.revision, PileSlot.PILE_1, second)).getOrNull()!!
            s = p.save(campaign, s.id, SaveSession(s.revision, s.title, "", s.notes, s.items.filter { it.id != second }.map { ItemNotes(it.id, "") })).getOrNull()!!
            val archive = archives.manifest(campaign, ExportSessions(listOf(s.id))).getOrNull()!!
            archive.version shouldBe 10
            archive.workspaces.single().workspace!!.sessionCards shouldBe emptyList()
            archive.workspaces.single().workspace!!.activeSceneItemId shouldBe first
            archive.workspaces.single().workspace!!.pile1.items shouldBe listOf(third)
            archive.workspaces.single().workspace!!.pile1.cover shouldBe third
            archive.workspaces.single().workspace!!.pile1.name shouldBe "Enemies"
            val codec = context.getBean(SessionArchiveCodec::class.java)
            codec.readTransfer(codec.writeTransfer(archive)).getOrNull() shouldBe archive
            val before = p.list(other).getOrNull()!!.sessions.size
            val malformed = archive.copy(workspaces = listOf(ArchivedWorkspace(s.id, archive.workspaces.single().workspace!!.copy(sessionCards = listOf(first)))))
            archives.restore(other, malformed).isLeft() shouldBe true
            val savedWorkspace = archive.workspaces.single().workspace!!
            for (bad in listOf(
                savedWorkspace.copy(activeSceneItemId = UUID.randomUUID()),
                savedWorkspace.copy(pile1 = savedWorkspace.pile1.copy(items = listOf(third, third))),
                savedWorkspace.copy(pile1 = savedWorkspace.pile1.copy(cover = UUID.randomUUID())),
                savedWorkspace.copy(pile2 = savedWorkspace.pile2.copy(cover = third))
            )) archives.restore(other, archive.copy(workspaces = listOf(ArchivedWorkspace(s.id, bad)))).isLeft() shouldBe true
            archives.restore(other, archive.copy(workspaces = emptyList())).isLeft() shouldBe true
            p.list(other).getOrNull()!!.sessions.size shouldBe before
            val imported = archives.restore(other, archive).getOrNull()!!.sessions.single().id
            val copy = p.open(other, imported).getOrNull()!!
            val remap = s.items.map { it.id }.zip(copy.items.map { it.id }).toMap()
            play.open(other, imported).getOrNull()!!.sessionCards shouldBe emptyList()
            play.open(other, imported).getOrNull()!!.activeSceneItemId shouldBe remap.getValue(first)
            play.open(other, imported).getOrNull()!!.pile1.cover shouldBe remap.getValue(third)
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
                context.getBean(ImageProcessor::class.java), tx, context.getBean(workbench.campaigns.api.Campaigns::class.java), context.getBean(PlayNoteTransfers::class.java))
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
                val playWrite = pool.submit<Either<Failure, WorkspaceData>> { attempting.countDown(); play.rename(campaign, s.id, RenamePile(current.revision, PileSlot.PILE_1, "Late")) }
                val export = pool.submit<SessionTransfer> { attempting.countDown(); archives.manifest(campaign, ExportSessions(listOf(s.id))).getOrNull()!! }
                check(attempting.await(10, TimeUnit.SECONDS))
                try { playWrite.get(150, TimeUnit.MILLISECONDS); error("Play write bypassed the held campaign lock") } catch (_: TimeoutException) { /* expected lock wait */ }
                try { export.get(150, TimeUnit.MILLISECONDS); error("Archive snapshot bypassed the held campaign lock") } catch (_: TimeoutException) { /* expected lock wait */ }
                release.countDown()
                s = prepare.get(15, TimeUnit.SECONDS)
                playWrite.get(15, TimeUnit.SECONDS).isLeft() shouldBe true
                val exported = export.get(15, TimeUnit.SECONDS)
                exported.sessions.single().notes shouldBe "locked"
                exported.sessions.single().sceneLinks shouldBe emptyList()
                exported.workspaces.single().workspace!!.pile1.items shouldBe listOf(third)
                exported.workspaces.single().workspace!!.activeSceneItemId shouldBe null
                exported.workspaces.single().workspace!!.pile1.cover shouldBe third
                play.open(campaign, s.id).getOrNull()!!.pile1.items shouldBe listOf(third)
            } finally { release.countDown(); pool.shutdownNow() }
            w = play.open(campaign, s.id).getOrNull()!!
            w = play.transition(campaign, s.id, TransitionScene(w.revision, s.revision, third)).getOrNull()!!
            context.close(); context = start()
            p = context.getBean(PreparationService::class.java); play = context.getBean(Playthroughs::class.java)
            p.open(campaign, s.id).getOrNull() shouldBe s
            play.open(campaign, s.id).getOrNull()!!.pile1.items shouldBe emptyList()
            play.open(campaign, s.id).getOrNull() shouldBe w
            val reopened = play.open(campaign, s.id).getOrNull()!!
            val cleared = play.transition(campaign, s.id, TransitionScene(reopened.revision, s.revision, null)).getOrNull()!!
            cleared.activeSceneItemId shouldBe null
            cleared.sessionCards shouldBe listOf(third)
            val jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate::class.java)
            jdbc.update("INSERT INTO playthroughs.workspace(session,revision,active,used,active_scene_item_id,focused_item_ids) VALUES (?,99,'[]','[]',NULL,'[]')", s.id)
            play.open(campaign, s.id).getOrNull() shouldBe cleared
            jdbc.queryForObject("SELECT revision FROM playthroughs.workspace WHERE session=?", Long::class.java, s.id) shouldBe 99L

            jdbc.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_schema='preparation' AND table_name='session' AND column_name='card_table'", Long::class.java) shouldBe 0L
            // Strict current-format reader: no silent field removal, coercion or duplicate keys.
            val reader = context.getBean(SessionArchiveReader::class.java)
            val mapper = context.getBean(ObjectMapper::class.java)
            for (bad in listOf("missing-cover", "name", "unknown", "old-active", "revision", "oversized")) {
                val malformedTree = mapper.valueToTree<ObjectNode>(archive)
                val workspaceNode = malformedTree.path("workspaces")[0].path("workspace") as ObjectNode
                val pileNode = workspaceNode.path("pile1") as ObjectNode
                when (bad) {
                    "missing-cover" -> pileNode.remove("cover")
                    "name" -> pileNode.put("name", "x".repeat(201))
                    "unknown" -> pileNode.put("extra", true)
                    "old-active" -> workspaceNode.putArray("active")
                    "revision" -> workspaceNode.put("revision", "0")
                    else -> { val items = pileNode.putArray("items"); repeat(1001) { items.add(third.toString()) } }
                }
                reader.readTransfer(mapper.writeValueAsBytes(malformedTree)).isLeft() shouldBe true
            }
            val tree = mapper.valueToTree<ObjectNode>(archive)
            tree.put("version", 6)
            reader.readTransfer(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
            tree.put("version", 10); tree.put("unknown", true)
            reader.readTransfer(mapper.writeValueAsBytes(tree)).isLeft() shouldBe true
            reader.readTransfer("{\"version\":10,\"version\":10}".toByteArray()).isLeft() shouldBe true
        } finally { context.close(); database.stop(); root.toFile().deleteRecursively() }
    }
})
