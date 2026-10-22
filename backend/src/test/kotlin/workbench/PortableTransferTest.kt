package workbench

import arrow.core.Either
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.core.io.Resource
import org.springframework.http.HttpOutputMessage
import org.springframework.http.HttpHeaders
import org.springframework.http.converter.ResourceHttpMessageConverter
import org.springframework.http.MediaType
import workbench.platform.adapter.image.FilePortableTransfers
import workbench.platform.adapter.image.TransferQuota
import workbench.platform.api.*
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import java.util.zip.CRC32

class PortableTransferTest : StringSpec({
    val transfers = FilePortableTransfers()
    fun directories(): Set<Path> = Files.list(Path.of(System.getProperty("java.io.tmpdir"))).use { paths ->
        paths.filter { it.fileName.toString().startsWith("workbench-transfer-") }.toList().toSet()
    }
    fun zip(entries: List<Pair<String, ByteArray>>, stored: Boolean = false): ByteArray = ByteArrayOutputStream().also { out ->
        ZipOutputStream(out).use { zip -> entries.forEach { (name, bytes) ->
            zip.putNextEntry(ZipEntry(name).apply { if (stored) { method = ZipEntry.STORED; size = bytes.size.toLong(); crc = CRC32().apply { update(bytes) }.value } })
            zip.write(bytes); zip.closeEntry()
        } }
    }.toByteArray()
    fun replaceAscii(bytes: ByteArray, from: String, to: String): ByteArray {
        require(from.length == to.length)
        val out = bytes.copyOf(); val pattern = from.toByteArray(); val replacement = to.toByteArray()
        var at = 0
        while (at <= out.size - pattern.size) {
            if ((pattern.indices).all { out[at + it] == pattern[it] }) { replacement.copyInto(out, at); at += pattern.size } else at++
        }
        return out
    }
    "actual byte counters accept exact portable and working limits and reject overflow" {
        for (limit in listOf(TransferLimits.ARCHIVE, TransferLimits.WORKING)) {
            val q = TransferQuota(limit, "test.limit", "limit")
            q.consume(limit - 1); q.consume(1)
            shouldThrow<TransferFailure> { q.consume(1) }.failure.code shouldBe "test.limit"
            shouldThrow<TransferFailure> { q.consume(Long.MAX_VALUE) }
        }
    }
    "duplicate, traversal, unknown, excessive, oversized, corrupt and truncated ZIP entries reject with cleanup" {
        val before = directories()
        val manifest = "{}".toByteArray(); val first = "images/${"a".repeat(64)}"; val second = "images/${"b".repeat(64)}"
        val valid = zip(listOf("manifest.json" to manifest, first to byteArrayOf(1)), stored = true)
        val corrupt = valid.copyOf().also { bytes ->
            // Corrupt the stored manifest payload while leaving both declared CRC values untouched.
            val text = String(bytes, Charsets.ISO_8859_1); val at = text.indexOf("{}")
            check(at >= 0); bytes[at] = '!'.code.toByte()
        }
        val invalid = listOf(
            zip(listOf("../outside" to manifest)), zip(listOf("unknown" to manifest)),
            zip(listOf("manifest.json" to manifest, first to byteArrayOf(1), second to byteArrayOf(2))),
            replaceAscii(zip(listOf("manifest.json" to manifest, first to byteArrayOf(1), second to byteArrayOf(2))), second, first),
            zip(listOf("manifest.json" to ByteArray(33))), corrupt, valid.copyOf(valid.size - 5))
        for (archive in invalid) {
            transfers.run<Unit> { w -> w.unpack(archive.inputStream(), 32, 1); Either.Right(Unit) }.isLeft() shouldBe true
            directories() shouldBe before
        }
        transfers.run<Unit> { w -> w.stage("manifest.json", byteArrayOf(1, 2, 3).inputStream(), 2); Either.Right(Unit) }.isLeft() shouldBe true
        directories() shouldBe before
        transfers.open().getOrNull()!!.use { workspace ->
            transfers.open().leftOrNull()!!.code shouldBe "archive.busy"
            workspace.unpack(valid.inputStream(), 32, 1).contentEquals(manifest) shouldBe true
        }
        directories() shouldBe before
    }
    "download leases survive until consumption and cleanup follows response-stream failure" {
        val before = directories()
        val result = transfers.run<PortableDownload> { w -> w.stage("manifest.json", "{}".byteInputStream(), 32); Either.Right(w.pack()) }
        transfers.open().isLeft() shouldBe true
        val response = result.downloadResponse("test.zip")
        val resource = response.body as Resource
        val output = object : HttpOutputMessage {
            override fun getHeaders() = HttpHeaders().apply { contentType = MediaType.parseMediaType("application/zip") }
            override fun getBody(): OutputStream = object : OutputStream() {
                override fun write(b: Int) { throw IOException("simulated disconnected client") }
                override fun write(b: ByteArray, off: Int, len: Int) { throw IOException("simulated disconnected client") }
            }
        }
        shouldThrow<IOException> { ResourceHttpMessageConverter().write(resource, MediaType.parseMediaType("application/zip"), output) }
        directories() shouldBe before
        transfers.open().getOrNull()!!.close()
    }
})
