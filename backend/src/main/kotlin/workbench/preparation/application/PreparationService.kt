package workbench.preparation.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.domain.*
import java.util.UUID
import java.security.MessageDigest

class PreparationService(private val campaigns: Campaigns, private val store: SessionStore, private val tx: Transactions, private val markdown: PreparationMarkdown, private val writing: workbench.writing.api.SessionDrafts, private val images: PreparationImageStore) {
    private fun invalid(message: String) = Failure.Invalid("preparation.invalid", message)
    private fun text(value: String) = value.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024
    private fun valid(s: SessionData): Boolean = s.title.isNotBlank() && s.title.length <= 200 && text(s.objective) && text(s.notes) && s.revision >= 0 &&
        validLinks(s) && s.items.map { it.id }.distinct().size == s.items.size && s.items.all { i ->
            (i.image == null || i.provenance.kind == "authored") && i.title.length <= 4096 && text(i.markdown) && text(i.notes) && i.provenance.path.isNotBlank() && i.provenance.path.length <= 4096 &&
                i.provenance.documentHash.matches(Regex("[a-f0-9]{64}")) && i.provenance.contentHash == hash(i.markdown) && (i.provenance.section != null || i.provenance.documentHash == i.provenance.contentHash) &&
                i.anchors.all { (original, local) -> text(original) && text(local) } && validCapture(i) && validOrigin(i)
        }
    private fun validLinks(s: SessionData): Boolean {
        val ids = s.items.map { it.id }.toSet()
        val scenes = s.items.filter { it.capturedSource?.classification?.let { c ->
            c.metadata?.type == "scene" && c.issues.none { it.severity == "error" }
        } == true }.map { it.id }.toSet()
        return s.sceneLinks.size <= 10000 && s.sceneLinks.distinct().size == s.sceneLinks.size &&
            s.sceneLinks.all { it.scene in scenes && it.item in ids }
    }
    fun association(campaign: UUID, id: UUID, scene: UUID, item: UUID, request: ChangeSceneAssociation): Either<Failure, SessionData> =
        mutate(campaign, id, request.revision) { s -> either {
            val edge = SceneLink(scene, item)
            ensure(validLinks(data(s.copy(sceneLinks = listOf(edge))))) { invalid("Both endpoints must be prepared in this session and the origin must be a valid Scene.") }
            s.copy(sceneLinks = if (request.linked) (s.sceneLinks + edge).distinct() else s.sceneLinks - edge)
        } }
    fun removalImpact(campaign: UUID, id: UUID, item: UUID): Either<Failure, RemovalImpact> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val s = load(campaign, id).bind()
        ensure(s.items.any { it.id == item }) { invalid("Card no longer belongs to this session.") }
        val affected = s.sceneLinks.filter { it.item == item || it.scene == item }.map { it.scene }.toSet()
        RemovalImpact(s.revision, s.items.filter { it.id in affected }.map { AffectedScene(it.id, it.title) })
    } }
    private fun hash(text: String) = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    fun list(campaign: UUID): Either<Failure, SessionList> = tx.run { either {
        campaigns.configuration(campaign).bind()
        SessionList(store.list(campaign).map { SessionSummary(it.id, it.title, it.objective, it.revision) })
    } }
    fun open(campaign: UUID, id: UUID): Either<Failure, SessionData> = tx.run { either {
        campaigns.configuration(campaign).bind(); data(load(campaign, id).bind())
    } }
    private fun load(campaign: UUID, id: UUID): Either<Failure, Session> = either {
        ensureNotNull(store.get(campaign, id)) { Failure.NotFound("preparation.not-found", "Session not found in this campaign.") }
    }
    fun create(campaign: UUID, request: CreateSession): Either<Failure, SessionData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val s = Session(UUID.randomUUID(), campaign, 0, request.title.trim(), request.objective, "", emptyList())
        ensure(valid(data(s))) { invalid("Use a title of 1–200 characters and keep text fields within 2 MiB.") }
        store.put(s); data(s)
    } }
    fun save(campaign: UUID, id: UUID, request: SaveSession): Either<Failure, SessionData> = mutate(campaign, id, request.revision) { s -> either {
        val byId = s.items.associateBy { it.id }
        val retained = request.items.map { it.id }.toSet()
        ensure(request.items.size == request.items.map { it.id }.distinct().size && request.items.all { it.id in byId }) { invalid("Item identities must be unique and belong to this session.") }
        s.copy(title = request.title.trim(), objective = request.objective, notes = request.notes,
            items = request.items.map { byId.getValue(it.id).copy(notes = it.notes) },
            sceneLinks = s.sceneLinks.filter { edge -> edge.scene in retained && edge.item in retained })
    } }
    internal fun addDraft(campaign: UUID, id: UUID, request: AddDraft): Either<Failure, SessionData> = mutate(campaign, id, request.revision) { s -> either {
        s.copy(items = s.items + freezeDraft(campaign, request.draft, request.draftRevision).bind())
    } }
    internal fun replaceDraft(campaign: UUID, id: UUID, item: UUID, request: AddDraft): Either<Failure, SessionData> = mutate(campaign, id, request.revision) { s -> either {
        val before = ensureNotNull(s.items.find { it.id == item }) { invalid("Prepared card no longer belongs to this session.") }
        val replacement = freezeDraft(campaign, request.draft, request.draftRevision).bind()
        ensure(before.provenance.campaign == campaign && before.provenance.section == null &&
            (before.provenance.authored?.card ?: before.capturedSource?.classification?.metadata?.id) == replacement.provenance.authored?.card &&
            before.capturedSource?.classification?.metadata?.type == replacement.capturedSource?.classification?.metadata?.type) {
            invalid("Only a whole card with the same origin identity and card type can replace this prepared version.")
        }
        s.copy(items = s.items.map { if (it.id == item) replacement.copy(id = before.id, notes = before.notes) else it })
    } }
    private fun freezeDraft(campaign: UUID, draft: UUID, revision: Long): Either<Failure, PreparedItem> = either {
        val approved = writing.retain(campaign, draft, revision).bind()
        val d = approved.snapshot
        writing.image(campaign, d.id, d.revision).bind()?.let { images.put(campaign, it) }
        val metadata = ensureNotNull(approved.preview.classification.metadata) { invalid("Draft is not ready for approval.") }
        val bodyStart = approved.markdown.length - d.fields.body.length
        val origin = d.origin
        val authored = AuthoredOrigin(d.id, d.card, d.revision, UUID.randomUUID(), java.time.Instant.now().toString(),
            origin?.raw, origin?.hash, origin?.campaign, origin?.capture, origin?.path,
            approved.links.map { FrozenLink(it.destination, it.kind, it.path, it.anchor, it.section,
                if (it.kind == "source") approved.capture else null, it.draft, it.revision) })
        val classification = CapturedClassification(CapturedCard(metadata.schema, metadata.id, metadata.title, metadata.type,
            metadata.purpose, metadata.status, metadata.tags, metadata.summary), emptyList())
        PreparedItem(UUID.randomUUID(), metadata.title, approved.markdown,
            Provenance(campaign, null, d.fields.path, null, approved.hash, approved.hash, "authored", authored),
            approved.preview.anchors.keys.associateWith { it }, "", CapturedSource(1, bodyStart, classification, emptyList()), d.image)
    }
    private fun mutate(campaign: UUID, id: UUID, revision: Long, change: (Session) -> Either<Failure, Session>): Either<Failure, SessionData> = tx.run { either {
        // Campaign's public configuration operation locks the campaign row across this transaction.
        campaigns.configuration(campaign).bind()
        val before = load(campaign, id).bind()
        ensure(before.revision == revision) { Failure.Conflict("preparation.stale-revision", "This session was changed elsewhere. Your edits are retained; reload explicitly before editing the newer revision.") }
        val changed = change(before).bind()
        val after = changed.copy(revision = before.revision + 1)
        ensure(valid(data(after)) && after.items.size <= 1000) { invalid("Session text or item limits exceeded.") }
        store.put(after); images.prune(campaign); data(after)
    } }
    fun export(campaign: UUID, request: ExportSessions, illustrated: Boolean = false): Either<Failure, Archive> = tx.run { either {
        campaigns.configuration(campaign).bind()
        ensure(request.sessions.isNotEmpty() && request.sessions.size <= 100 && request.sessions.distinct().size == request.sessions.size) { invalid("Select between 1 and 100 distinct sessions.") }
        ensure(store.archiveBytes(campaign, request.sessions) <= 20L * 1024 * 1024) { invalid("Session text exceeds the 20 MiB manifest limit; select fewer sessions.") }
        val archive = Archive(9, request.sessions.map { data(load(campaign, it).bind()) })
        ensure(illustrated || archive.sessions.all { s -> s.items.all { it.image == null } }) { invalid("Artwork requires portable ZIP export.") }
        ensure(archive.sessions.sumOf { it.items.size } <= 1000) { invalid("An archive may contain at most 1,000 items.") }
        archive
    } }
    fun validateArchive(archive: Archive, illustrated: Boolean = false): Either<Failure, Unit> = either {
        ensure(archive.version == 9 && archive.sessions.isNotEmpty() && archive.sessions.size <= 100 && archive.sessions.sumOf { it.items.size } <= 1000 &&
            archive.sessions.map { it.id }.distinct().size == archive.sessions.size &&
            archive.sessions.flatMap { it.items }.let { items -> items.map { it.id }.distinct().size == items.size } && archive.sessions.all(::valid)) { invalid("Invalid or unsupported session contents. No sessions imported.") }
        ensure(illustrated || archive.sessions.all { s -> s.items.all { it.image == null } }) { invalid("Artwork requires a portable archive.") }
    }
    fun import(campaign: UUID, archive: Archive, illustrated: Boolean = false): Either<Failure, SessionList> = tx.run { either {
        campaigns.configuration(campaign).bind()
        validateArchive(archive, illustrated).bind()
        ensure(archive.sessions.flatMap { it.items }.all { i -> i.image?.let { illustrated && images.metadata(campaign, it.hash) == it } ?: true }) { invalid("Artwork references are unavailable or inconsistent.") }
        val sessions = archive.sessions.map { source ->
            val original = model(source)
            val ids = original.items.associate { it.id to UUID.randomUUID() }
            original.copy(id = UUID.randomUUID(), campaign = campaign, revision = 0,
                items = original.items.map { it.copy(id = ids.getValue(it.id)) },
                sceneLinks = original.sceneLinks.map { SceneLink(ids.getValue(it.scene), ids.getValue(it.item)) })
        }
        sessions.forEach(store::put)
        SessionList(sessions.map { SessionSummary(it.id, it.title, it.objective, it.revision) })
    } }
    fun preview(input: MarkdownInput): Either<Failure, RenderedMarkdown> = either {
        ensure(text(input.markdown)) { invalid("Markdown must be within 2 MiB.") }; markdown.render(input.markdown)
    }
    fun view(campaign: UUID, id: UUID): Either<Failure, SessionView> = either {
        val s = open(campaign, id).bind()
        val captured = markdown.captured(model(s).items)
        SessionView(markdown.render(s.notes), s.items.map { RenderedItem(it.id, captured.getValue(it.id), markdown.render(it.notes)) })
    }
    fun candidates(campaign: UUID, session: UUID, originItem: UUID, linkKey: String): Either<Failure, PreparedTargetCandidates> = either {
        val items = model(open(campaign, session).bind()).items
        val origin = ensureNotNull(items.find { it.id == originItem }) { invalid("Origin card is no longer prepared.") }
        val index = linkKey.removePrefix("prepared-link-").toIntOrNull()
        ensure(index != null && index >= 0 && linkKey == "prepared-link-$index" && index < (origin.provenance.authored?.links?.size ?: origin.capturedSource?.relationships?.size ?: 0)) { invalid("Unknown frozen link.") }
        val relation = origin.capturedSource?.relationships?.getOrNull(index)
        val authored = origin.provenance.authored?.links?.getOrNull(index)
        val destination = authored?.destination ?: relation?.destination
        val uri = try { java.net.URI(destination?.replace(" ", "%20") ?: "") } catch (_: Exception) { null }
        val unsafe = uri == null || uri.isAbsolute || uri.authority != null || uri.query != null || uri.path.orEmpty().startsWith('/') || '\\' in uri.path.orEmpty()
        var depth = origin.provenance.path.substringBeforeLast('/', "").split('/').count { it.isNotEmpty() }
        var escapesRoot = false
        for (segment in uri?.path.orEmpty().split('/')) when (segment) {
            "", "." -> Unit
            ".." -> if (depth == 0) escapesRoot = true else depth--
            else -> depth++
        }
        val incompatible = relation?.classification?.metadata?.purpose?.let { it != "session" } == true
        val unavailable = incompatible || unsafe || escapesRoot || destination == null || (authored == null && (relation?.target?.missing != false || relation.target.external != null)) ||
            (authored != null && authored.kind !in setOf("local", "self", "source", "draft"))
        val matches = if (unavailable) emptyList() else markdown.targets(origin, items, index, destination)
        PreparedTargetCandidates(when {
            matches.size > 1 -> PreparedTargetState.AMBIGUOUS
            matches.size == 1 -> PreparedTargetState.MATCHED
            unavailable -> PreparedTargetState.UNAVAILABLE
            else -> PreparedTargetState.UNPREPARED
        }, matches)
    }
    private fun orderedLinks(s: Session): List<SceneAssociation> {
        val positions = s.items.mapIndexed { index, item -> item.id to index }.toMap()
        return s.sceneLinks.sortedWith(compareBy({ positions[it.scene] }, { positions[it.item] })).map { SceneAssociation(it.scene, it.item) }
    }
    private fun data(s: Session) = SessionData(s.id, s.campaign, s.revision, s.title, s.objective, s.notes, s.items.map { i -> PreparedItemData(i.id, i.title, i.markdown, ProvenanceData(i.provenance.campaign, i.provenance.capture, i.provenance.path, i.provenance.section, i.provenance.documentHash, i.provenance.contentHash, i.provenance.kind, i.provenance.authored?.data()), i.anchors, i.notes, i.capturedSource?.data(), i.image) }, orderedLinks(s))
    private fun model(s: SessionData) = Session(s.id, s.campaign, s.revision, s.title, s.objective, s.notes, s.items.map { i -> PreparedItem(i.id, i.title, i.markdown, Provenance(i.provenance.campaign, i.provenance.capture, i.provenance.path, i.provenance.section, i.provenance.documentHash, i.provenance.contentHash, i.provenance.kind, i.provenance.authored?.model()), i.anchors, i.notes, i.capturedSource?.model(), i.image) }, s.sceneLinks.map { SceneLink(it.scene, it.item) })
}
