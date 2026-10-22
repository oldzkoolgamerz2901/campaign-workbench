package workbench.platform.api

import arrow.core.Either
import java.io.InputStream
import java.security.MessageDigest

/** Owns its buffer; neither callers nor persistence adapters can mutate the retained value. */
class ImageBytes(bytes: ByteArray) {
    private val value = bytes.copyOf()
    val size: Int get() = value.size
    val sha256: String by lazy { MessageDigest.getInstance("SHA-256").digest(value).joinToString("") { "%02x".format(it) } }
    fun copy(): ByteArray = value.copyOf()
    fun stream(): InputStream = value.inputStream()
}

data class ImageMetadata(val hash: String, val mime: String, val width: Int, val height: Int, val bytes: Int) {
    init {
        require(hash.matches(Regex("[a-f0-9]{64}")))
        require(mime in setOf("image/jpeg", "image/png", "image/webp"))
        require(width in 1..ImageLimits.DIMENSION && height in 1..ImageLimits.DIMENSION)
        require(width.toLong() * height <= ImageLimits.PIXELS && bytes in 1..ImageLimits.ORIGINAL_BYTES)
    }
}
enum class ImageVariant(val longestSide: Int) { DISPLAY(1600), THUMBNAIL(320) }
data class ImageDerivative(val policy: Int, val variant: ImageVariant, val mime: String, val width: Int, val height: Int, val content: ImageBytes) {
    init {
        require(policy > 0 && mime in setOf("image/jpeg", "image/png"))
        require(width in 1..variant.longestSide && height in 1..variant.longestSide)
        require(content.size in 1..ImageLimits.DERIVATIVE_BYTES)
    }
}
data class ProcessedImage(val metadata: ImageMetadata, val original: ImageBytes, val derivatives: List<ImageDerivative>) {
    init {
        require(metadata.hash == original.sha256 && metadata.bytes == original.size)
        require(derivatives.map { it.policy to it.variant }.distinct().size == derivatives.size)
        require(derivatives.map { it.variant }.toSet() == ImageVariant.entries.toSet())
    }
}
object ImageLimits {
    const val ORIGINAL_BYTES = 10 * 1024 * 1024
    const val DERIVATIVE_BYTES = 12 * 1024 * 1024
    const val DIMENSION = 16_384
    const val PIXELS = 40_000_000L
    const val POLICY = 1
}
interface ImageProcessor {
    /** Reads at most the original byte limit plus one byte; caller owns and closes input. */
    fun process(input: InputStream): Either<Failure, ProcessedImage>
}
