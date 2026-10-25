package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.testcontainers.postgresql.PostgreSQLContainer
import org.springframework.jdbc.core.JdbcTemplate
import workbench.campaigns.api.*
import workbench.campaigns.application.CampaignService
import workbench.preparation.api.*
import workbench.preparation.application.PreparationService
import workbench.playthroughs.api.*
import java.nio.file.Files
import java.time.Instant
import java.util.UUID

class PlayHistoryIntegrationTest : StringSpec({
    "history backfills existing notes, isolates dimensions and campaigns, and paginates exact immutable chronology" {
        val db = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        db.start()
        val root = Files.createTempDirectory("p6-history-")
        val args = arrayOf("--server.port=0", "--spring.datasource.url=${db.jdbcUrl}", "--spring.datasource.username=${db.username}", "--spring.datasource.password=${db.password}")
        var c = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run(*args, "--spring.flyway.target=20", "--spring.jpa.hibernate.ddl-auto=none")
        try {
            val campaigns = c.getBean(CampaignService::class.java)
            val campaign = campaigns.register(RegisterCampaign("History", root.toString())).getOrNull()!!.id
            // The legacy bootstrap uses no Writing service before V22 exists. Seed a real pre-V22 row for the additive migration check.
            val legacyDraft = UUID.randomUUID()
            c.getBean(JdbcTemplate::class.java).update("INSERT INTO writing.draft(id,campaign,card,revision,title,type,status,tags,summary,body,path) VALUES (?,?,?,0,'Legacy','npc','draft','[]','','# Old body','legacy.md')", legacyDraft, campaign, UUID.randomUUID())
            val other = campaigns.register(RegisterCampaign("Other", Files.createDirectory(root.resolve("other")).toString())).getOrNull()!!.id
            val preparation = c.getBean(PreparationService::class.java)
            val first = preparation.create(campaign, CreateSession("First session", "")).getOrNull()!!
            val second = preparation.create(campaign, CreateSession("Independent imported copy", "")).getOrNull()!!
            val outside = preparation.create(other, CreateSession("Isolated", "")).getOrNull()!!
            val ref = ResourceReference(UUID.randomUUID(), UUID.randomUUID()) // imported foreign origin
            val differentOrigin = ref.copy(campaign = UUID.randomUUID())
            val base = Instant.parse("2026-10-24T12:00:00Z")
            val transfer = c.getBean(PlayNoteTransfers::class.java)
            fun note(session: SessionData, time: Instant, resource: ResourceReference? = ref,
                scene: ResourceReference? = null, pinned: Boolean = false) = PlayNoteData(UUID.randomUUID(), session.campaign,
                session.id, 0, "Historical **text**", scene?.let { ResourceSnapshot(it, "Old Scene title") },
                ResourceSnapshot(resource, "Same title and path cannot establish identity"), time, time, pinned)
            transfer.restore(campaign, first.id, listOf(
                note(first, base), note(first, base), note(first, base.plusNanos(1), pinned = true),
                note(first, base.plusNanos(2)), note(first, base.plusNanos(3), differentOrigin),
                note(first, base.plusNanos(4), null, ref), note(first, base.plusNanos(5), null),
                note(first, Instant.parse("+1000000000-12-31T23:59:59.999999999Z")),
                note(first, Instant.parse("-1000000000-01-01T00:00:00Z"))
            )).isRight() shouldBe true
            transfer.restore(campaign, second.id, listOf(note(second, base))).isRight() shouldBe true
            transfer.restore(other, outside.id, listOf(note(outside, base.plusSeconds(1)))).isRight() shouldBe true
            c.close()
            // V21 indexes the unchanged P5 records, including extreme Instant years and nanos.
            c = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run(*args)
            val migrated = c.getBean(workbench.writing.application.WritingService::class.java).open(campaign, legacyDraft).getOrNull()!!
            migrated.fields.backText shouldBe ""
            migrated.encoding shouldBe 1
            val api = c.getBean(PlayNotes::class.java)
            fun history(scene: Boolean = false, pins: Boolean = false, limit: Int = 50, time: Instant? = null, id: UUID? = null) =
                api.history(campaign, ref, scene, pins, limit, time, id).getOrNull()!!
            val all = history()
            all.entries.size shouldBe 7
            all.entries.first().note.createdAt shouldBe Instant.MAX
            all.entries.last().note.createdAt shouldBe Instant.MIN
            all.entries.map { it.sessionTitle }.toSet() shouldBe setOf("First session", "Independent imported copy")
            val expected = all.entries.map { it.note }.sortedWith(compareByDescending<PlayNoteData> { it.createdAt }.thenByDescending { it.id.toString() })
            all.entries.map { it.note } shouldBe expected
            history(pins = true).entries.map { it.note.id } shouldBe expected.filter { it.pinned }.map { it.id }
            history(scene = true).entries.size shouldBe 1
            history(scene = true).entries.single().note.resource!!.reference shouldBe null
            api.history(campaign, differentOrigin, false, false, 20, null, null).getOrNull()!!.entries.size shouldBe 1
            api.history(other, ref, false, false, 20, null, null).getOrNull()!!.entries.size shouldBe 1
            api.history(UUID.randomUUID(), ref, false, false, 20, null, null).isLeft() shouldBe true
            listOf(0, 51, Int.MAX_VALUE).forEach { api.history(campaign, ref, false, false, it, null, null).isLeft() shouldBe true }
            api.history(campaign, ref, false, false, 20, base, null).isLeft() shouldBe true
            api.history(campaign, ref, false, false, 20, null, UUID.randomUUID()).isLeft() shouldBe true
            val collected = mutableListOf<UUID>()
            var page = history(limit = 2)
            while (true) {
                collected.addAll(page.entries.map { it.note.id })
                if (page.nextTime == null) break
                page = history(limit = 2, time = page.nextTime, id = page.nextId)
            }
            collected shouldBe expected.map { it.id }
            val pinned = expected.first { it.pinned }
            api.edit(campaign, pinned.session, pinned.id, EditPlayNote(0, "Edited later", false, false, null)).isRight() shouldBe true
            history().entries.map { it.note.id } shouldBe collected
            history(pins = true).entries.size shouldBe 0
            api.targets(campaign, first.id).getOrNull()!!.targets shouldBe emptyList()
            api.targets(other, first.id).isLeft() shouldBe true
            // There is no live original or prepared item: captured note text/context remain readable.
            history().entries.first { it.note.id == pinned.id }.note.markdown shouldBe "Edited later"
            val jdbc = c.getBean(JdbcTemplate::class.java)
            jdbc.queryForObject("SELECT count(*) FROM pg_indexes WHERE schemaname='playthroughs' AND indexname IN ('play_note_resource_history','play_note_scene_history')", Long::class.java) shouldBe 2L
            jdbc.execute("SET enable_seqscan = off")
            val plan = jdbc.queryForList("EXPLAIN SELECT state FROM playthroughs.play_note WHERE state::jsonb #>> '{note,campaign}' = '$campaign' AND state::jsonb #>> '{note,resource,reference,campaign}' = '${ref.campaign}' AND state::jsonb #>> '{note,resource,reference,card}' = '${ref.card}' ORDER BY playthroughs.note_time(state::jsonb #>> '{note,createdAt}') DESC, id DESC LIMIT 2").toString()
            plan.contains("play_note_resource_history") shouldBe true
        } finally { c.close(); db.stop(); root.toFile().deleteRecursively() }
    }
})
