package workbench.platform.adapter.image

import arrow.core.Either
import org.springframework.stereotype.Component
import workbench.platform.api.*
import java.awt.RenderingHints
import java.awt.geom.AffineTransform
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.concurrent.Semaphore
import javax.imageio.ImageIO
import javax.imageio.stream.MemoryCacheImageInputStream
import javax.imageio.stream.MemoryCacheImageOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

@Component
class ImageIoProcessor : ImageProcessor {
    // All callers, including archive work and separate application contexts, share one decode slot.
    override fun process(input: InputStream): Either<Failure, ProcessedImage> {
        if (!slot.tryAcquire()) return Either.Left(Failure.Unreadable("image.busy", "Image processing is busy. Retry shortly."))
        return try {
            val bytes = input.readNBytes(ImageLimits.ORIGINAL_BYTES + 1)
            require(bytes.size in 1..ImageLimits.ORIGINAL_BYTES)
            val header = ImageStructure.inspect(bytes)
            MemoryCacheImageInputStream(ByteArrayInputStream(bytes)).use { stream ->
                val readers = ImageIO.getImageReaders(stream)
                require(readers.hasNext())
                val reader = readers.next()
                try {
                    reader.input = stream
                    reader.addIIOReadWarningListener { _, _ -> error("Invalid image data.") }
                    val width = reader.getWidth(0); val height = reader.getHeight(0)
                    require(width in 1..ImageLimits.DIMENSION && height in 1..ImageLimits.DIMENSION)
                    require(width.toLong() * height <= ImageLimits.PIXELS)
                    val image = reader.read(0) ?: error("Image cannot be decoded.")
                    try {
                        require(image.width == width && image.height == height)
                        val original = ImageBytes(bytes)
                        val transparent = hasTransparency(image)
                        Either.Right(ProcessedImage(ImageMetadata(original.sha256, header.mime, width, height, bytes.size), original,
                            ImageVariant.entries.map { derivative(image, header.orientation, it, transparent) }))
                    } finally { image.flush() }
                } finally { reader.dispose() }
            }
        } catch (_: Exception) {
            Either.Left(Failure.Invalid("image.invalid", "Choose a valid static JPEG, PNG or WebP within 10 MiB, 40 megapixels and 16,384 pixels per side."))
        } finally { slot.release() }
    }
    private fun hasTransparency(image: BufferedImage): Boolean {
        val alpha = image.alphaRaster ?: return false
        val opaque = (1L shl alpha.sampleModel.getSampleSize(0)) - 1
        val row = IntArray(image.width)
        for (y in 0 until image.height) {
            alpha.getSamples(0, y, image.width, 1, 0, row)
            if (row.any { (it.toLong() and 0xffffffffL) != opaque }) return true
        }
        return false
    }
    private fun derivative(source: BufferedImage, orientation: Int, variant: ImageVariant, alpha: Boolean): ImageDerivative {
        val swapped = orientation >= 5
        val width = if (swapped) source.height else source.width
        val height = if (swapped) source.width else source.height
        val factor = minOf(1.0, variant.longestSide.toDouble() / max(width, height))
        val w = max(1, (width * factor).roundToInt()); val h = max(1, (height * factor).roundToInt())
        val target = BufferedImage(w, h, if (alpha) BufferedImage.TYPE_INT_ARGB else BufferedImage.TYPE_INT_RGB)
        try {
            val transform = AffineTransform.getScaleInstance(w.toDouble() / width, h.toDouble() / height)
            val sw = source.width.toDouble(); val sh = source.height.toDouble()
            transform.concatenate(when (orientation) {
                2 -> AffineTransform(-1.0, 0.0, 0.0, 1.0, sw, 0.0)
                3 -> AffineTransform(-1.0, 0.0, 0.0, -1.0, sw, sh)
                4 -> AffineTransform(1.0, 0.0, 0.0, -1.0, 0.0, sh)
                5 -> AffineTransform(0.0, 1.0, 1.0, 0.0, 0.0, 0.0)
                6 -> AffineTransform(0.0, 1.0, -1.0, 0.0, sh, 0.0)
                7 -> AffineTransform(0.0, -1.0, -1.0, 0.0, sh, sw)
                8 -> AffineTransform(0.0, -1.0, 1.0, 0.0, 0.0, sw)
                else -> AffineTransform()
            })
            target.createGraphics().let { graphics ->
                try {
                    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC)
                    graphics.drawImage(source, transform, null)
                } finally { graphics.dispose() }
            }
            val bytes = object : ByteArrayOutputStream() {
                override fun write(b: Int) { require(count < ImageLimits.DERIVATIVE_BYTES); super.write(b) }
                override fun write(b: ByteArray, off: Int, len: Int) { require(count.toLong() + len <= ImageLimits.DERIVATIVE_BYTES); super.write(b, off, len) }
            }
            val format = if (alpha) "png" else "jpeg"
            MemoryCacheImageOutputStream(bytes).use { out ->
                val writer = ImageIO.getImageWritersByFormatName(format).next()
                try { writer.output = out; writer.write(target) } finally { writer.dispose() }
            }
            return ImageDerivative(ImageLimits.POLICY, variant, "image/$format", w, h, ImageBytes(bytes.toByteArray()))
        } finally { target.flush() }
    }
    companion object { private val slot = Semaphore(1) }
}
