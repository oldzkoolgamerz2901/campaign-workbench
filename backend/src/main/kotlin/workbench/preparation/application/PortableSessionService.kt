package workbench.preparation.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.platform.api.*
import workbench.preparation.api.*
import java.io.InputStream
import java.util.UUID

class PortableSessionService(private val preparation: PreparationService, private val images: PreparationImageStore,
    private val transfers: PortableTransfers, private val codec: SessionArchiveCodec, private val processor: ImageProcessor, private val tx: Transactions, private val campaigns: workbench.campaigns.api.Campaigns) {
    fun export(campaign: UUID, request: ExportSessions): Either<Failure, PortableDownload> = transfers.run { work -> either {
        tx.run { either {
            val archive = preparation.export(campaign, request, illustrated = true).bind()
            val metadata = archive.sessions.flatMap { it.items }.mapNotNull { it.image }.distinctBy { it.hash }
            work.stage("manifest.json", codec.write(archive).inputStream(), 20L * 1024 * 1024)
            for (m in metadata) {
                ensure(images.metadata(campaign, m.hash) == m) { Failure.Unreadable("image.unavailable", "Required session artwork is unavailable.") }
                val original = ensureNotNull(images.original(campaign, m.hash)) { Failure.Unreadable("image.unavailable", "Required session artwork is unavailable.") }
                original.stream().use { work.stage("images/${m.hash}", it, ImageLimits.ORIGINAL_BYTES.toLong()) }
            }
        } }.bind()
        work.pack()
    } }
    fun import(campaign: UUID, input: InputStream): Either<Failure, SessionList> = transfers.run { work -> either {
        val (zip, source) = input.isZip()
        if (!zip) {
            val bytes = source.readNBytes(20 * 1024 * 1024 + 1)
            return@either preparation.import(campaign, codec.read(bytes).bind()).bind()
        }
        val archive = codec.readIllustrated(work.unpack(source, 20 * 1024 * 1024, 1000)).bind()
        preparation.validateArchive(archive, illustrated = true).bind()
        val metadata = work.validateImages(archive.sessions.flatMap { it.items }.mapNotNull { it.image }, processor).bind()
        tx.run { either {
            campaigns.configuration(campaign).bind()
            metadata.forEach { images.put(campaign, work.image(it)) }
            preparation.import(campaign, archive, illustrated = true).bind()
        } }.bind()
    } }
}
