package workbench.platform.api

import arrow.core.Either
import arrow.core.raise.*
import java.io.InputStream

object TransferLimits {
    const val ARCHIVE = 256L * 1024 * 1024
    const val WORKING = 1024L * 1024 * 1024
}
class TransferFailure(val failure: Failure) : RuntimeException(failure.message)
interface PortableDownload : AutoCloseable {
    val size: Long
    fun input(): InputStream
}
interface TransferWorkspace : AutoCloseable {
    fun stage(name: String, input: InputStream, limit: Long)
    fun input(name: String): InputStream
    fun names(): Set<String>
    /** Validates the container and stages only canonical entries; never extracts caller-controlled paths. */
    fun unpack(input: InputStream, manifestLimit: Int, maxImages: Int): ByteArray
    /** Includes manifest.json and images only; processed derivatives stay local to staging. */
    fun pack(): PortableDownload
    fun stageImage(image: ProcessedImage)
    fun image(metadata: ImageMetadata): ProcessedImage
}
interface PortableTransfers {
    fun open(): Either<Failure, TransferWorkspace>
}

fun TransferWorkspace.validateImages(descriptors: List<ImageMetadata>, processor: ImageProcessor): Either<Failure, List<ImageMetadata>> = arrow.core.raise.either {
    val invalid = Failure.Invalid("archive.images", "Archive image membership or metadata is inconsistent. No records imported.")
    val groups = descriptors.groupBy { it.hash }
    ensure(groups.values.all { it.distinct().size == 1 }) { invalid }
    val unique = groups.values.map { it.first() }
    ensure(names().filter { it.startsWith("images/") }.toSet() == unique.map { "images/${it.hash}" }.toSet()) { invalid }
    for (metadata in unique) {
        val image = input("images/${metadata.hash}").use { processor.process(it) }.bind()
        ensure(image.metadata == metadata) { invalid }
        stageImage(image)
    }
    unique
}

/** Content sniffing is independent of the filename/content type supplied by a caller. */
fun InputStream.isZip(): Pair<Boolean, InputStream> {
    val source = java.io.PushbackInputStream(this, 4)
    val prefix = source.readNBytes(4); source.unread(prefix)
    return (prefix.size == 4 && prefix[0] == 80.toByte() && prefix[1] == 75.toByte()) to source
}

/** A transfer owns its workspace until a download is consumed; all other exits close it immediately. */
fun <T> PortableTransfers.run(block: (TransferWorkspace) -> Either<Failure, T>): Either<Failure, T> = open().fold(
    { Either.Left(it) }, { workspace ->
        var handedOff = false
        try { block(workspace).also { handedOff = it.getOrNull() is PortableDownload } }
        catch (e: TransferFailure) { Either.Left(e.failure) }
        catch (_: Exception) { Either.Left(Failure.Invalid("archive.invalid", "Invalid, unavailable or oversized portable archive. No records imported.")) }
        finally { if (!handedOff) workspace.close() }
    })
