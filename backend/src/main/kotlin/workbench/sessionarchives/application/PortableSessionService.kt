package workbench.sessionarchives.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.platform.api.*
import workbench.campaigns.api.Campaigns
import workbench.preparation.api.*
import workbench.playthroughs.api.WorkspaceTransfers
import workbench.sessionarchives.api.*
import java.io.InputStream
import java.util.UUID

/** Composition boundary: coordinates public module contracts in one campaign transaction. */
class PortableSessionService(private val preparation: PreparationTransfers, private val workspaces: WorkspaceTransfers,
    private val transfers: PortableTransfers, private val codec: SessionArchiveCodec, private val processor: ImageProcessor,
    private val tx: Transactions, private val campaigns: Campaigns) {
    private fun invalid() = Failure.Invalid("sessions.archive-format", "Invalid or unsupported current-format session archive. No sessions imported.")
    fun manifest(campaign: UUID, request: ExportSessions, illustrated: Boolean = false): Either<Failure, SessionTransfer> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val contents = preparation.exportContents(campaign, request, illustrated).bind()
        val result = SessionTransfer(7, contents.sessions, contents.sessions.map { ArchivedWorkspace(it.id, workspaces.snapshot(campaign, it.id).bind()) })
        val encoded = try { codec.writeTransfer(result) } catch (_: Exception) { raise(Failure.Invalid("sessions.archive-size", "Session manifest exceeds 20 MiB; select fewer sessions.")) }
        ensure(encoded.size <= 20 * 1024 * 1024) { invalid() }
        result
    } }
    fun validate(archive: SessionTransfer, illustrated: Boolean): Either<Failure, Unit> = either {
        ensure(archive.version == 7) { invalid() }
        preparation.validateContents(Archive(archive.version, archive.sessions), illustrated).bind()
        val ids = archive.sessions.map { it.id }.toSet()
        ensure(archive.workspaces.size == ids.size && archive.workspaces.map { it.session }.toSet() == ids) { invalid() }
        val byId = archive.sessions.associateBy { it.id }
        archive.workspaces.forEach { record -> record.workspace?.let { w ->
            val all = w.active + w.used
            ensure(w.session == record.session && w.revision >= 0 && all.size == all.distinct().size &&
                all.toSet() == byId.getValue(record.session).items.map { it.id }.toSet() &&
                w.focusedItemIds.size <= 3 && w.focusedItemIds.distinct().size == w.focusedItemIds.size &&
                all.containsAll(w.focusedItemIds) && (w.activeSceneItemId == null ||
                    byId.getValue(record.session).items.any { item -> item.id == w.activeSceneItemId &&
                        item.capturedSource?.classification?.let { c -> c.metadata?.type == "scene" && c.issues.none { it.severity == "error" } } == true })) { invalid() }
        } }
    }
    fun restore(campaign: UUID, archive: SessionTransfer, illustrated: Boolean = false): Either<Failure, SessionList> = tx.run { either {
        campaigns.configuration(campaign).bind()
        validate(archive, illustrated).bind()
        val imported = preparation.importContents(campaign, Archive(archive.version, archive.sessions), illustrated).bind()
        val workspaceBySession = archive.workspaces.associateBy { it.session }
        for ((original, summary) in archive.sessions.zip(imported.sessions)) {
            val restored = preparation.snapshot(campaign, summary.id).bind()
            val ids = original.items.map { it.id }.zip(restored.items.map { it.id }).toMap()
            val workspace = workspaceBySession.getValue(original.id).workspace?.let { w ->
                w.copy(session = restored.id, revision = 0, active = w.active.map(ids::getValue), used = w.used.map(ids::getValue), activeSceneItemId = w.activeSceneItemId?.let(ids::getValue), focusedItemIds = w.focusedItemIds.map(ids::getValue))
            }
            workspaces.restore(campaign, restored.id, workspace).bind()
        }
        imported
    } }
    fun export(campaign: UUID, request: ExportSessions): Either<Failure, PortableDownload> = transfers.run { work -> either {
        tx.run { either {
            campaigns.configuration(campaign).bind()
            val archive = manifest(campaign, request, illustrated = true).bind()
            val metadata = archive.sessions.flatMap { it.items }.mapNotNull { it.image }.distinctBy { it.hash }
            work.stage("manifest.json", codec.writeTransfer(archive).inputStream(), 20L * 1024 * 1024)
            for (m in metadata) {
                ensure(preparation.imageMetadata(campaign, m.hash) == m) { Failure.Unreadable("image.unavailable", "Required session artwork is unavailable.") }
                val original = ensureNotNull(preparation.imageOriginal(campaign, m.hash)) { Failure.Unreadable("image.unavailable", "Required session artwork is unavailable.") }
                original.stream().use { work.stage("images/${m.hash}", it, ImageLimits.ORIGINAL_BYTES.toLong()) }
            }
        } }.bind()
        work.pack()
    } }
    fun import(campaign: UUID, input: InputStream): Either<Failure, SessionList> = transfers.run { work -> either {
        val (zip, source) = input.isZip()
        ensure(zip) { invalid() }
        val archive = codec.readTransfer(work.unpack(source, 20 * 1024 * 1024, 1000)).bind()
        validate(archive, illustrated = true).bind()
        val metadata = work.validateImages(archive.sessions.flatMap { it.items }.mapNotNull { it.image }, processor).bind()
        tx.run { either {
            campaigns.configuration(campaign).bind()
            metadata.forEach { preparation.putImage(campaign, work.image(it)) }
            restore(campaign, archive, illustrated = true).bind()
        } }.bind()
    } }
}
