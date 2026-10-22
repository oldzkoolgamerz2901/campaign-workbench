package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import workbench.platform.adapter.image.ImageIoProcessor
import workbench.platform.api.*
import java.awt.Color
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.imageio.ImageIO

class ImageProcessorTest : StringSpec({
    val processor = ImageIoProcessor()
    fun process(bytes: ByteArray) = processor.process(bytes.inputStream())
    "real JPEG, PNG and lossy, lossless and transparent WebP decode with immutable originals" {
        val fixtures = listOf(ImageFixtures.jpeg(), ImageFixtures.png(40, 20), ImageFixtures.png(40, 20, true)) +
            listOf("lossy", "lossless", "transparent").map(ImageFixtures::webp)
        fixtures.forEach { bytes ->
            val result = process(bytes).getOrNull() ?: error("Expected valid image")
            result.original.copy().contentEquals(bytes) shouldBe true
            val hash = result.original.sha256
            val copy = result.original.copy(); copy[0] = 0
            bytes[0] = 0
            result.original.sha256 shouldBe hash
            result.original.copy()[0] shouldBe (if (result.metadata.mime == "image/png") -119 else if (result.metadata.mime == "image/jpeg") -1 else 82).toByte()
            result.derivatives.size shouldBe 2
            result.derivatives.forEach { d ->
                val decoded = ImageIO.read(d.content.stream())
                decoded.width shouldBe d.width; decoded.height shouldBe d.height
                (maxOf(d.width, d.height) <= d.variant.longestSide) shouldBe true
                decoded.flush()
            }
        }
        val alpha = process(ImageFixtures.webp("transparent")).getOrNull()!!
        alpha.derivatives.all { it.mime == "image/png" } shouldBe true
        val decoded = ImageIO.read(alpha.derivatives.first().content.stream())
        decoded.colorModel.hasAlpha() shouldBe true
        (0 until decoded.height).any { y -> (0 until decoded.width).any { x -> decoded.getRGB(x, y).ushr(24) < 255 } } shouldBe true
        decoded.flush()
        process(ImageFixtures.jpeg()).getOrNull()!!.derivatives.all { it.mime == "image/jpeg" } shouldBe true
        val opaque = java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_ARGB)
        for (y in 0..1) for (x in 0..1) opaque.setRGB(x, y, Color.RED.rgb)
        val encoded = java.io.ByteArrayOutputStream().also { ImageIO.write(opaque, "png", it) }.toByteArray()
        opaque.flush()
        process(encoded).getOrNull()!!.derivatives.all { it.mime == "image/jpeg" } shouldBe true
        process(ImageFixtures.png(2, 2, alpha = true, depth = 16, opaqueAlpha = true)).getOrNull()!!.derivatives.all { it.mime == "image/jpeg" } shouldBe true
        process(ImageFixtures.png(2, 2, alpha = true, depth = 16)).getOrNull()!!.derivatives.all { it.mime == "image/png" } shouldBe true
    }
    "all eight EXIF orientations normalize pixels and dimensions without carrying EXIF metadata" {
        val corners = listOf(Color.RED, Color.GREEN, Color.YELLOW, Color.BLUE, Color.RED, Color.BLUE, Color.YELLOW, Color.GREEN)
        for (orientation in 1..8) {
            val result = process(ImageFixtures.jpeg(orientation)).getOrNull()!!
            result.metadata.width shouldBe 60; result.metadata.height shouldBe 40
            val display = result.derivatives.first { it.variant == ImageVariant.DISPLAY }
            display.width shouldBe if (orientation >= 5) 40 else 60
            display.height shouldBe if (orientation >= 5) 60 else 40
            val image = ImageIO.read(display.content.stream())
            val actual = Color(image.getRGB(5, 5)); val expected = corners[orientation - 1]
            (kotlin.math.abs(actual.red - expected.red) < 60 && kotlin.math.abs(actual.green - expected.green) < 60 && kotlin.math.abs(actual.blue - expected.blue) < 60) shouldBe true
            String(display.content.copy(), Charsets.ISO_8859_1).contains("Exif") shouldBe false
            image.flush()
        }
        val png = process(ImageFixtures.insertPng(ImageFixtures.png(40, 20), "eXIf", ImageFixtures.tiff(6))).getOrNull()!!
        png.derivatives.first().width shouldBe 20
        png.derivatives.first().height shouldBe 40
    }
    "display sizes preserve aspect, never upscale, and originals survive derivative generation" {
        val bytes = ImageFixtures.png(3200, 1600)
        val image = process(bytes).getOrNull()!!
        image.derivatives.map { it.width to it.height } shouldBe listOf(1600 to 800, 320 to 160)
        image.original.copy().contentEquals(bytes) shouldBe true
        process(ImageFixtures.png(13, 7)).getOrNull()!!.derivatives.map { it.width to it.height } shouldBe listOf(13 to 7, 13 to 7)
    }
    "byte, dimension and pixel limits are inclusive and oversized headers fail before decoding" {
        val small = ImageFixtures.png(1, 1)
        val exact = ImageFixtures.insertPng(small, "paDd", ByteArray(ImageLimits.ORIGINAL_BYTES - small.size - 12))
        exact.size shouldBe ImageLimits.ORIGINAL_BYTES
        process(exact).isRight() shouldBe true
        process(exact + byteArrayOf(0)).isLeft() shouldBe true
        process(ImageFixtures.png(16384, 1)).isRight() shouldBe true
        process(ImageFixtures.png(8000, 5000)).isRight() shouldBe true
        fun header(w: Int, h: Int): ByteArray {
            val ihdr = small.copyOfRange(16, 29)
            ByteBuffer.wrap(ihdr).putInt(w).putInt(h)
            return small.copyOfRange(0, 8) + ImageFixtures.chunk("IHDR", ihdr) + small.copyOfRange(33, small.size)
        }
        process(header(16385, 1)).isLeft() shouldBe true
        process(header(8001, 5000)).isLeft() shouldBe true
        process(header(Int.MAX_VALUE, Int.MAX_VALUE)).isLeft() shouldBe true
        var read = 0
        val endless = object : InputStream() {
            override fun read(): Int { read++; return 0 }
            override fun read(b: ByteArray, off: Int, len: Int): Int { java.util.Arrays.fill(b, off, off + len, 0.toByte()); read += len; return len }
        }
        processor.process(endless).isLeft() shouldBe true
        read shouldBe ImageLimits.ORIGINAL_BYTES + 1
    }
    "animated, corrupt, truncated and unsupported content is rejected" {
        val png = ImageFixtures.png(2, 2)
        process(ImageFixtures.insertPng(png, "acTL", ByteArray(8))).isLeft() shouldBe true
        val webp = ImageFixtures.webp("lossy")
        val animated = webp + "ANIM".toByteArray() + ByteArray(4)
        ByteBuffer.wrap(animated, 4, 4).order(ByteOrder.LITTLE_ENDIAN).putInt(animated.size - 8)
        process(animated).isLeft() shouldBe true
        listOf(png.copyOf(png.size - 1), webp.copyOf(webp.size - 1), ImageFixtures.jpeg().copyOf(50), "<svg/>".toByteArray(), "GIF89a".toByteArray(), byteArrayOf()).forEach {
            process(it).leftOrNull()!!.code shouldBe "image.invalid"
        }
        val corrupt = png.copyOf(); corrupt[45] = (corrupt[45].toInt() xor 1).toByte()
        process(corrupt).isLeft() shouldBe true
        val truncatedJpeg = ImageFixtures.jpeg().copyOf(650) + byteArrayOf(-1, -39)
        process(truncatedJpeg).isLeft() shouldBe true
    }
    "concurrent processing returns a retryable failure and always releases its slot" {
        val entered = CountDownLatch(1); val release = CountDownLatch(1)
        val input = object : ByteArrayInputStream(ImageFixtures.png(1, 1)) {
            override fun readNBytes(len: Int): ByteArray { entered.countDown(); check(release.await(10, TimeUnit.SECONDS)); return super.readNBytes(len) }
        }
        val executor = Executors.newSingleThreadExecutor()
        try {
            val future = executor.submit<Any> { processor.process(input) }
            entered.await(10, TimeUnit.SECONDS) shouldBe true
            process(ImageFixtures.png(1, 1)).leftOrNull()!!.code shouldBe "image.busy"
            release.countDown(); future.get(10, TimeUnit.SECONDS)
        } finally { release.countDown(); executor.shutdownNow() }
        process(byteArrayOf()).isLeft() shouldBe true
        process(ImageFixtures.png(1, 1)).isRight() shouldBe true
    }
})
