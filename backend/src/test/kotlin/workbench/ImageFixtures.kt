package workbench

import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32
import java.util.zip.DeflaterOutputStream
import javax.imageio.ImageIO

internal object ImageFixtures {
    fun webp(name: String) = javaClass.getResourceAsStream("/images/$name.webp")!!.use { it.readBytes() }
    fun chunk(type: String, data: ByteArray): ByteArray {
        val name = type.toByteArray(Charsets.US_ASCII)
        val crc = CRC32().apply { update(name); update(data) }.value.toInt()
        return ByteBuffer.allocate(data.size + 12).putInt(data.size).put(name).put(data).putInt(crc).array()
    }
    // Build large valid boundary fixtures one scanline at a time, without allocating a large source raster.
    fun png(width: Int, height: Int, alpha: Boolean = false, depth: Int = 8, opaqueAlpha: Boolean = false): ByteArray {
        val compressed = ByteArrayOutputStream()
        DeflaterOutputStream(compressed).use { out ->
            val sampleBytes = depth / 8
            val row = ByteArray(width * (if (alpha) 4 else 3) * sampleBytes + 1)
            if (alpha && opaqueAlpha) repeat(width) { x ->
                repeat(sampleBytes) { byte -> row[1 + x * 4 * sampleBytes + 3 * sampleBytes + byte] = -1 }
            }
            repeat(height) { out.write(row) }
        }
        val header = ByteBuffer.allocate(13).putInt(width).putInt(height).put(depth.toByte()).put(if (alpha) 6 else 2).put(0).put(0).put(0).array()
        return byteArrayOf(-119, 80, 78, 71, 13, 10, 26, 10) + chunk("IHDR", header) + chunk("IDAT", compressed.toByteArray()) + chunk("IEND", byteArrayOf())
    }
    fun insertPng(bytes: ByteArray, type: String, payload: ByteArray) = bytes.copyOfRange(0, 33) + chunk(type, payload) + bytes.copyOfRange(33, bytes.size)
    fun tiff(orientation: Int) = ByteBuffer.allocate(26).order(ByteOrder.LITTLE_ENDIAN)
        .put('I'.code.toByte()).put('I'.code.toByte()).putShort(42).putInt(8).putShort(1)
        .putShort(274).putShort(3).putInt(1).putShort(orientation.toShort()).putShort(0).putInt(0).array()
    fun jpeg(orientation: Int? = null): ByteArray {
        val image = BufferedImage(60, 40, BufferedImage.TYPE_INT_RGB)
        image.createGraphics().let { g ->
            try {
                listOf(Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW).forEachIndexed { i, color ->
                    g.color = color; g.fillRect(i % 2 * 30, i / 2 * 20, 30, 20)
                }
            } finally { g.dispose() }
        }
        val raw = ByteArrayOutputStream().also { ImageIO.write(image, "jpeg", it) }.toByteArray()
        image.flush()
        if (orientation == null) return raw
        val payload = "Exif\u0000\u0000".toByteArray(Charsets.ISO_8859_1) + tiff(orientation)
        val app1 = byteArrayOf(-1, -31) + ByteBuffer.allocate(2).putShort((payload.size + 2).toShort()).array() + payload
        // Keep JFIF APP0 first.
        val at = 4 + ((raw[4].toInt() and 255) * 256 + (raw[5].toInt() and 255))
        return raw.copyOfRange(0, at) + app1 + raw.copyOfRange(at, raw.size)
    }
}
