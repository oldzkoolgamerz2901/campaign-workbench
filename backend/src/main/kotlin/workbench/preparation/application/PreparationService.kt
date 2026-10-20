package workbench.preparation.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.sources.api.Sources
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.domain.*
import java.util.UUID
import java.security.MessageDigest

class PreparationService(private val campaigns: Campaigns, private val sources: Sources, private val store: SessionStore, private val tx: Transactions, private val markdown: PreparationMarkdown, private val writing: workbench.writing.api.SessionDrafts) {
    private fun invalid(message: String) = Failure.Invalid("preparation.invalid", message)
    private fun text(value: String) = value.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024
    private fun valid(s: SessionData): Boolean = s.title.isNotBlank() && s.title.length <= 200 && text(s.objective) && text(s.notes) && s.revision >= 0 &&
        s.items.map { it.id }.distinct().size == s.items.size && s.items.all { i ->
            i.title.length <= 4096 && text(i.markdown) && text(i.notes) && i.provenance.path.isNotBlank() && i.provenance.path.length <= 4096 &&
                i.provenance.documentHash.matches(Regex("[a-f0-9]{64}")) && i.provenance.contentHash == hash(i.markdown) && (i.provenance.section != null || i.provenance.documentHash == i.provenance.contentHash) &&
                i.anchors.all { (original, local) -> text(original) && text(local) } && validCapture(i) && validOrigin(i)
        }
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
        ensure(request.items.size == request.items.map { it.id }.distinct().size && request.items.all { it.id in byId }) { invalid("Item identities must be unique and belong to this session.") }
        s.copy(title = request.title.trim(), objective = request.objective, notes = request.notes,
            items = request.items.map { byId.getValue(it.id).copy(notes = it.notes) })
    } }
    fun add(campaign: UUID, id: UUID, request: AddSource): Either<Failure, SessionData> = mutate(campaign, id, request.revision) { s -> either {
        val selected = sources.select(campaign, request.capture, request.path, request.section).bind()
        s.copy(items = s.items + PreparedItem(UUID.randomUUID(), selected.title, selected.markdown,
            Provenance(selected.campaign, selected.capture, selected.path, selected.section, selected.documentHash, selected.contentHash), selected.anchors, "", selected.freeze()))
    } }
    fun addDraft(campaign: UUID, id: UUID, request: AddDraft): Either<Failure, SessionData> = mutate(campaign, id, request.revision) { s -> either {
        val approved = writing.retain(campaign, request.draft, request.draftRevision).bind()
        val d = approved.snapshot
        val metadata = ensureNotNull(approved.preview.classification.metadata) { invalid("Draft is not ready for approval.") }
        val bodyStart = approved.markdown.length - d.fields.body.length
        val origin = d.origin
        val authored = AuthoredOrigin(d.id, d.card, d.revision, UUID.randomUUID(), java.time.Instant.now().toString(),
            origin?.raw, origin?.hash, origin?.campaign, origin?.capture, origin?.path,
            approved.links.map { FrozenLink(it.destination, it.kind, it.path, it.anchor, it.section,
                if (it.kind == "source") approved.capture else null, it.draft, it.revision) })
        val classification = CapturedClassification(CapturedCard(metadata.schema, metadata.id, metadata.title, metadata.type,
            metadata.purpose, metadata.status, metadata.tags, metadata.summary), emptyList())
        s.copy(items = s.items + PreparedItem(UUID.randomUUID(), metadata.title, approved.markdown,
            Provenance(campaign, null, d.fields.path, null, approved.hash, approved.hash, "authored", authored),
            approved.preview.anchors.keys.associateWith { it }, "", CapturedSource(1, bodyStart, classification, emptyList())))
    } }
    private fun mutate(campaign: UUID, id: UUID, revision: Long, change: (Session) -> Either<Failure, Session>): Either<Failure, SessionData> = tx.run { either {
        // Campaign's public configuration operation locks the campaign row across this transaction.
        campaigns.configuration(campaign).bind()
        val before = load(campaign, id).bind()
        ensure(before.revision == revision) { Failure.Conflict("preparation.stale-revision", "This session was changed elsewhere. Your edits are retained; reload explicitly before editing the newer revision.") }
        val after = change(before).bind().copy(revision = before.revision + 1)
        ensure(valid(data(after)) && after.items.size <= 1000) { invalid("Session text or item limits exceeded.") }
        store.put(after); data(after)
    } }
    fun export(campaign: UUID, request: ExportSessions): Either<Failure, Archive> = tx.run { either {
        campaigns.configuration(campaign).bind()
        ensure(request.sessions.isNotEmpty() && request.sessions.size <= 100 && request.sessions.distinct().size == request.sessions.size) { invalid("Select between 1 and 100 distinct sessions.") }
        val archive = Archive(3, request.sessions.map { data(load(campaign, it).bind()) })
        ensure(archive.sessions.sumOf { it.items.size } <= 1000) { invalid("An archive may contain at most 1,000 items.") }
        archive
    } }
    fun import(campaign: UUID, archive: Archive): Either<Failure, SessionList> = tx.run { either {
        campaigns.configuration(campaign).bind()
        ensure(archive.version in setOf(1, 2, 3) && archive.sessions.isNotEmpty() && archive.sessions.size <= 100 && archive.sessions.sumOf { it.items.size } <= 1000 &&
            archive.sessions.map { it.id }.distinct().size == archive.sessions.size &&
            (archive.version != 3 || archive.sessions.flatMap { it.items }.let { items -> items.map { it.id }.distinct().size == items.size }) && archive.sessions.all(::valid) &&
            (archive.version == 3 || archive.sessions.all { s -> s.items.all { it.provenance.kind == "source" } }) &&
            (archive.version != 1 || archive.sessions.all { s -> s.items.all { it.capturedSource == null } })) { invalid("Invalid or unsupported session archive. No sessions imported.") }
        val sessions = archive.sessions.map { source -> model(source).copy(id = UUID.randomUUID(), campaign = campaign, revision = 0,
            items = model(source).items.map { it.copy(id = UUID.randomUUID()) }) }
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
    private fun data(s: Session) = SessionData(s.id, s.campaign, s.revision, s.title, s.objective, s.notes, s.items.map { i -> PreparedItemData(i.id, i.title, i.markdown, ProvenanceData(i.provenance.campaign, i.provenance.capture, i.provenance.path, i.provenance.section, i.provenance.documentHash, i.provenance.contentHash, i.provenance.kind, i.provenance.authored?.data()), i.anchors, i.notes, i.capturedSource?.data()) })
    private fun model(s: SessionData) = Session(s.id, s.campaign, s.revision, s.title, s.objective, s.notes, s.items.map { i -> PreparedItem(i.id, i.title, i.markdown, Provenance(i.provenance.campaign, i.provenance.capture, i.provenance.path, i.provenance.section, i.provenance.documentHash, i.provenance.contentHash, i.provenance.kind, i.provenance.authored?.model()), i.anchors, i.notes, i.capturedSource?.model()) })
}
