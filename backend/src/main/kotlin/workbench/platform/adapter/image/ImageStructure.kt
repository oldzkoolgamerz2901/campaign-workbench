package workbench.platform.adapter.image

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

/** Container checks precede ImageIO: decoding frame zero alone does not reject animation. */
internal object ImageStructure {
    data class Header(val mime: String, val orientation: Int)
    fun inspect(b: ByteArray): Header = when {
        b.size >= 8 && b.copyOfRange(0, 8).contentEquals(byteArrayOf(-119, 80, 78, 71, 13, 10, 26, 10)) -> png(b)
        b.size >= 12 && text(b, 0, 4) == "RIFF" && text(b, 8, 4) == "WEBP" -> webp(b)
        b.size >= 4 && u(b[0]) == 255 && u(b[1]) == 216 -> jpeg(b)
        else -> error("Only static JPEG, PNG and WebP are supported.")
    }
    private fun png(b: ByteArray): Header {
        var at = 8; var orientation = 1; var ihdr = false; var data = false; var end = false
        while (at < b.size) {
            require(at.toLong() + 12 <= b.size)
            val length = int(b, at, false)
            require(length >= 0 && at.toLong() + length + 12 <= b.size)
            val type = text(b, at + 4, 4)
            require(type.all { it in 'A'..'Z' || it in 'a'..'z' })
            val crc = CRC32().apply { update(b, at + 4, length + 4) }.value
            require(crc == (int(b, at + 8 + length, false).toLong() and 0xffffffffL))
            require(type !in setOf("acTL", "fcTL", "fdAT")) { "Animated PNG is unsupported." }
            require(ihdr || (type == "IHDR" && length == 13))
            when (type) {
                "IHDR" -> { require(!ihdr); ihdr = true }
                "IDAT" -> data = true
                "eXIf" -> orientation = exif(b.copyOfRange(at + 8, at + 8 + length))
                "IEND" -> { require(length == 0 && data); end = true; require(at + 12 == b.size) }
                else -> require(type[0].isLowerCase() || type == "PLTE")
            }
            at += length + 12
        }
        require(end)
        return Header("image/png", orientation)
    }
    private fun webp(b: ByteArray): Header {
        require((int(b, 4, true).toLong() and 0xffffffffL) + 8 == b.size.toLong())
        var at = 12; var images = 0; var orientation = 1; var extended = false
        while (at < b.size) {
            require(at.toLong() + 8 <= b.size)
            val type = text(b, at, 4); val length = int(b, at + 4, true)
            require(length >= 0 && at.toLong() + 8 + length + (length and 1) <= b.size)
            require(type !in setOf("ANIM", "ANMF")) { "Animated WebP is unsupported." }
            when (type) {
                "VP8X" -> { require(at == 12 && length == 10 && !extended); extended = true; require(u(b[at + 8]) and 2 == 0) }
                "VP8 ", "VP8L" -> images++
                "EXIF" -> orientation = exif(b.copyOfRange(at + 8, at + 8 + length))
            }
            if (length and 1 == 1) require(b[at + 8 + length] == 0.toByte())
            at += 8 + length + (length and 1)
        }
        require(images == 1)
        return Header("image/webp", orientation)
    }
    private fun jpeg(b: ByteArray): Header {
        require(u(b[b.size - 2]) == 255 && u(b.last()) == 217)
        var at = 2; var orientation = 1; var scan = false
        while (at < b.size - 2) {
            require(u(b[at++]) == 255)
            while (at < b.size && u(b[at]) == 255) at++
            require(at < b.size)
            val marker = u(b[at++])
            require(marker !in setOf(0, 216, 217))
            require(at + 2 <= b.size)
            val length = u(b[at]) * 256 + u(b[at + 1])
            require(length >= 2 && at.toLong() + length <= b.size)
            if (marker == 225 && length >= 8 && text(b, at + 2, 6) == "Exif\u0000\u0000") {
                orientation = exif(b.copyOfRange(at + 8, at + length))
            }
            if (marker == 218) { scan = true; break }
            at += length
        }
        require(scan)
        return Header("image/jpeg", orientation)
    }
    private fun exif(raw: ByteArray): Int {
        val b = if (raw.size >= 6 && text(raw, 0, 6) == "Exif\u0000\u0000") raw.copyOfRange(6, raw.size) else raw
        require(b.size >= 8)
        val little = text(b, 0, 2) == "II"
        require(little || text(b, 0, 2) == "MM")
        val buffer = ByteBuffer.wrap(b).order(if (little) ByteOrder.LITTLE_ENDIAN else ByteOrder.BIG_ENDIAN)
        fun short(at: Int): Int { require(at >= 0 && at.toLong() + 2 <= b.size); return buffer.getShort(at).toInt() and 65535 }
        require(short(2) == 42)
        val offset = buffer.getInt(4)
        if (offset == 0) return 1
        require(offset >= 8)
        val count = short(offset)
        require(offset.toLong() + 2 + count.toLong() * 12 + 4 <= b.size)
        var result = 1; var found = false
        repeat(count) {
            val at = offset + 2 + it * 12
            if (short(at) == 274) {
                require(!found && short(at + 2) == 3 && buffer.getInt(at + 4) == 1)
                result = short(at + 8); require(result in 1..8); found = true
            }
        }
        return result
    }
    private fun u(b: Byte) = b.toInt() and 255
    private fun text(b: ByteArray, at: Int, size: Int) = String(b, at, size, Charsets.ISO_8859_1)
    private fun int(b: ByteArray, at: Int, little: Boolean) = ByteBuffer.wrap(b, at, 4).order(if (little) ByteOrder.LITTLE_ENDIAN else ByteOrder.BIG_ENDIAN).int
}
