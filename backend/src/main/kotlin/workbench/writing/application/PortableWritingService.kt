package workbench.writing.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.platform.api.*
import workbench.writing.api.*
import java.io.InputStream
import java.util.UUID

class PortableWritingService(private val recovery: RecoveryService, private val images: WritingImageStore,
    private val transfers: PortableTransfers, private val codec: RecoveryCodec, private val processor: ImageProcessor, private val tx: Transactions) {
    fun backup(campaign: UUID): Either<Failure, PortableDownload> = export(WritingImageOwner.Campaign(campaign)) { recovery.snapshot(campaign, illustrated = true) }
    fun archive(workspace: UUID): Either<Failure, PortableDownload> = export(WritingImageOwner.Recovery(workspace)) { recovery.workspace(workspace).map { it.copy(version = 6) } }
    private fun export(owner: WritingImageOwner, snapshot: () -> Either<Failure, WritingArchive>): Either<Failure, PortableDownload> = transfers.run { work -> either {
        tx.run { either {
            val archive = snapshot().bind()
            val metadata = recovery.artwork(archive).distinctBy { it.hash }
            work.stage("manifest.json", codec.write(archive).inputStream(), RECOVERY_BYTES.toLong())
            for (m in metadata) {
                ensure(images.metadata(owner, m.hash) == m) { Failure.Unreadable("image.unavailable", "Required Writing artwork is unavailable.") }
                val original = ensureNotNull(images.original(owner, m.hash)) { Failure.Unreadable("image.unavailable", "Required Writing artwork is unavailable.") }
                original.stream().use { work.stage("images/${m.hash}", it, ImageLimits.ORIGINAL_BYTES.toLong()) }
            }
        } }.bind()
        work.pack()
    } }
    fun restore(input: InputStream): Either<Failure, RecoverySummary> = transfers.run { work -> either {
        val (zip, source) = input.isZip()
        if (!zip) return@either recovery.restore(source.readNBytes(RECOVERY_BYTES + 1)).bind()
        val archive = codec.readIllustrated(work.unpack(source, RECOVERY_BYTES, 11000))
        recovery.validateArchive(archive).bind()
        val metadata = work.validateImages(recovery.artwork(archive), processor).bind()
        recovery.install(archive) { workspace -> metadata.forEach { images.put(WritingImageOwner.Recovery(workspace), work.image(it)) } }.bind()
    } }
}
