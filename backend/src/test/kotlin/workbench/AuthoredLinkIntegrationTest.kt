package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.sources.application.SourceService
import workbench.writing.api.*
import workbench.writing.application.*
import workbench.preparation.api.*
import workbench.preparation.application.*
import java.nio.file.Files
import java.util.UUID

class AuthoredLinkIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("authored-link-")
    var context: org.springframework.context.ConfigurableApplicationContext? = null
    beforeSpec {
        database.start()
        context = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0",
            "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively() }
    fun writing() = context!!.getBean(WritingService::class.java)
    fun library() = context!!.getBean(CardLibraryService::class.java)
    fun sources() = context!!.getBean(SourceService::class.java)
    fun exports() = context!!.getBean(WritingExportService::class.java)
    fun campaign(name: String): Pair<UUID, java.nio.file.Path> {
        val path = Files.createDirectory(root.resolve(name))
        Files.writeString(path.resolve("target.md"), "---\nworkbench:\n  schema: 1\n  id: ${UUID.randomUUID()}\n  title: Target\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# Source heading\nOld file")
        Files.writeString(path.resolve("legacy.md"), "# Legacy\nOld untyped file")
        Files.writeString(path.resolve("witness.md"), "# Witness\n[Effective](target.md#repeat-1) [Legacy](legacy.md#effective) [Only](only.md#only)")
        val id = context!!.getBean(CampaignService::class.java).register(RegisterCampaign(name, path.toString())).getOrNull()!!.id
        sources().refresh(id).isRight() shouldBe true
        return id to path
    }
    fun save(d: DraftData, fields: DraftFields) = writing().save(d.campaign, d.id, SaveDraft(d.revision, fields)).getOrNull()!!
    fun associated(campaign: UUID, path: String = "target.md"): DraftData {
        val capture = sources().authoringLibrary(campaign).getOrNull()!!.capture!!
        val d = library().editSource(campaign, EditLibrarySource(capture, path)).getOrNull()!!
        return save(d, d.fields.copy(title = "Effective $path", type = "scene", path = "working/$path", body = "# Effective\n## Repeat\nFirst\n## Repeat\nSecond"))
    }
    fun origin(campaign: UUID, body: String = "# Origin\n[Target](target.md#repeat-1)"): DraftData {
        val d = writing().create(campaign, CreateDraft("scene", false)).getOrNull()!!
        return save(d, d.fields.copy(title = "Origin", path = "origin.md", body = body))
    }
    fun inspect(d: DraftData) = exports().inspect(d.campaign, d.id,
        InspectExport(d.revision, sources().authoringLibrary(d.campaign).getOrNull()!!.capture)).getOrNull()!!

    "typed and explicit untyped associations share effective headings across aliases and Source-only readers" {
        val (campaign) = campaign("aliases")
        val target = associated(campaign)
        val legacy = associated(campaign, "legacy.md")
        val only = writing().create(campaign, CreateDraft("npc", false)).getOrNull()!!
        val savedOnly = save(only, only.fields.copy(title = "Only", path = "only.md", body = "# Only"))
        val origin = origin(campaign, "# Origin\n[Source alias](target.md#repeat-1) [Draft placement](working/target.md#repeat-1) [Legacy](legacy.md#effective) [Only](only.md#only) [Self](origin.md#origin) [Old heading](target.md#source-heading) [Unsafe](../escape.md)")
        val preview = writing().preview(campaign, origin.id, origin.fields).getOrNull()!!
        preview.checkedLinks.map { it.kind } shouldBe listOf("draft", "draft", "draft", "draft", "self", "missing-anchor", "unsupported")
        preview.checkedLinks.take(2).map { it.draft to it.revision }.distinct() shouldBe listOf(target.id to target.revision)
        preview.checkedLinks[2].draft shouldBe legacy.id
        preview.checkedLinks[3].draft shouldBe savedOnly.id
        val catalogue = library().list(campaign).getOrNull()!!
        val targetEntry = catalogue.entries.single { it.draft == target.id }
        val document = library().document(campaign, targetEntry.key, catalogue.capture, target.revision, draft = target.id).getOrNull()!!
        preview.checkedLinks.first().section shouldBe document.draftPreview!!.preview.anchors["repeat-1"]
        val witness = catalogue.entries.single { it.title == "witness.md" }
        val read = library().document(campaign, witness.key, catalogue.capture, null).getOrNull()!!
        read.checkedLinks.map { it.kind } shouldBe listOf("draft", "draft", "draft")
        val unsaved = origin.fields.copy(path = "unsaved.md", body = "# Unsaved\n[Self](unsaved.md#unsaved)")
        writing().preview(campaign, origin.id, unsaved).getOrNull()!!.checkedLinks.single().kind shouldBe "self"
        val punctuation = save(savedOnly, savedOnly.fields.copy(path = "odd # name.md"))
        val encodedLink = writing().preview(campaign, origin.id, origin.fields.copy(body = "[Encoded](odd%20%23%20name.md#only)")).getOrNull()!!.checkedLinks.single()
        encodedLink.kind shouldBe "draft"
        library().document(campaign, "card:${punctuation.card}", catalogue.capture, punctuation.revision,
            draft = punctuation.id, linkPath = encodedLink.path).isRight() shouldBe true
        library().document(campaign, "card:${punctuation.card}", catalogue.capture, punctuation.revision,
            draft = punctuation.id, linkPath = "../escape.md").leftOrNull()!!.code shouldBe "writing.link-path"
    }

    "independent path claims and duplicate Source UUIDs remain conflicts rather than associations" {
        val (campaign, path) = campaign("conflicts")
        val target = associated(campaign)
        val origin = origin(campaign)
        val competing = writing().create(campaign, CreateDraft("scene", false)).getOrNull()!!
        save(competing, competing.fields.copy(title = "Independent", path = "target.md", body = "# Repeat"))
        writing().preview(campaign, origin.id, origin.fields).getOrNull()!!.checkedLinks.single().kind shouldBe "ambiguous"
        val capture = sources().authoringLibrary(campaign).getOrNull()!!.capture
        library().document(campaign, "card:${target.card}", capture, target.revision, draft = target.id, linkPath = "target.md").leftOrNull()!!.code shouldBe "writing.link-target-changed"
        // Ordinary explicit reading remains possible; following an ambiguous locator does not.
        library().document(campaign, "card:${target.card}", capture, target.revision, draft = target.id).isRight() shouldBe true
        writing().delete(campaign, competing.id, 1).isRight() shouldBe true
        Files.copy(path.resolve("target.md"), path.resolve("duplicate.md"))
        sources().refresh(campaign).isRight() shouldBe true
        writing().preview(campaign, origin.id, origin.fields).getOrNull()!!.checkedLinks.single().kind shouldBe "ambiguous"
    }

    "export tracks moved target revisions and distinguishes effective Drafts from incorporated files" {
        val (campaign, path) = campaign("export")
        var target = associated(campaign)
        val origin = origin(campaign)
        val report = inspect(origin)
        report.links.single().kind shouldBe "draft"
        report.warnings.any { it.contains("captured campaign file differs") } shouldBe true
        report.targetRevisions[target.id.toString()] shouldBe target.revision
        val artifact = exports().create(campaign, origin.id, CreateExport(origin.revision, report.capture, report.fingerprint, true)).getOrNull()!!
        target = save(target, target.fields.copy(body = target.fields.body + "\nNew target text"))
        exports().create(campaign, origin.id, CreateExport(origin.revision, report.capture, report.fingerprint, true)).leftOrNull()!!.code shouldBe "writing.export-stale"
        exports().artifact(campaign, origin.id, artifact.id).getOrNull()!!.markdown shouldBe artifact.report.markdown
        val targetReport = inspect(target)
        Files.writeString(path.resolve("target.md"), targetReport.markdown)
        sources().refresh(campaign).isRight() shouldBe true
        val incorporated = inspect(origin)
        incorporated.links.single().kind shouldBe "draft"
        incorporated.links.single().warning shouldBe null
        incorporated.targetRevisions[target.id.toString()] shouldBe target.revision
    }

    "new alias links freeze exact revisions and recover without changing retained approvals or historical contents" {
        val (campaign) = campaign("frozen")
        val target = associated(campaign)
        val origin = origin(campaign)
        val c = context!!
        val approvals = c.getBean(SessionDrafts::class.java)
        approvals.retain(campaign, target.id, target.revision).isRight() shouldBe true
        val retained = approvals.retain(campaign, origin.id, origin.revision).getOrNull()!!
        retained.links.single().path shouldBe "target.md"
        retained.links.single().draft shouldBe target.id
        val preparation = c.getBean(PreparationService::class.java)
        var session = preparation.create(campaign, CreateSession("Frozen aliases", "")).getOrNull()!!
        val catalogue = library().list(campaign).getOrNull()!!
        val add = c.getBean(SessionLibraryService::class.java)
        for (d in listOf(target, origin)) session = add.add(campaign, session.id,
            AddLibraryCard(session.revision, "card:${d.card}", catalogue.capture, d.id, d.revision)).getOrNull()!!.session
        val before = preparation.view(campaign, session.id).getOrNull()!!
        before.items.last().source.links.single().target shouldBe "@${session.items.first().id}#repeat-1"
        save(target, target.fields.copy(body = "# Changed target"))
        approvals.retain(campaign, origin.id, origin.revision).getOrNull() shouldBe retained
        preparation.view(campaign, session.id).getOrNull() shouldBe before
        val archive = preparation.export(campaign, ExportSessions(listOf(session.id))).getOrNull()!!
        val imported = preparation.import(campaign, archive).getOrNull()!!.sessions.single().id
        val restored = preparation.open(campaign, imported).getOrNull()!!
        preparation.view(campaign, imported).getOrNull()!!.items.last().source.links.single().target shouldBe "@${restored.items.first().id}#repeat-1"
        val recovery = c.getBean(RecoveryService::class.java)
        val bytes = recovery.backup(campaign).getOrNull()!!
        recovery.restore(bytes).isRight() shouldBe true
        val writingArchive = c.getBean(RecoveryCodec::class.java).read(bytes)
        fun tampered(change: (workbench.sources.api.CheckedLink) -> workbench.sources.api.CheckedLink) = writingArchive.copy(approved = writingArchive.approved.map { r ->
            if (r.snapshot.id == origin.id) r.copy(links = r.links.map(change)) else r
        })
        recovery.validateArchive(tampered { it.copy(anchor = "absent") }).isLeft() shouldBe true
        recovery.validateArchive(tampered { it.copy(path = "../escape.md") }).isLeft() shouldBe true
    }
})
