package workbench.platform.adapter.image

import arrow.core.Either
import org.springframework.stereotype.Component
import workbench.platform.api.*
import java.io.FilterOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.Semaphore
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream
import java.util.zip.CRC32

@Component
class FilePortableTransfers : PortableTransfers {
    override fun open(): Either<Failure, TransferWorkspace> {
        if (!slot.tryAcquire()) return Either.Left(Failure.Unreadable("archive.busy", "Another portable transfer is active. Retry shortly."))
        return try { Either.Right(Workspace(Files.createTempDirectory("workbench-transfer-")) { slot.release() }) }
        catch (_: Exception) { slot.release(); Either.Left(Failure.Unreadable("archive.storage", "Temporary archive storage is unavailable.")) }
    }
    private class Workspace(private val root: Path, private val release: () -> Unit) : TransferWorkspace {
        private val files = linkedMapOf<String, Path>()
        private val working = TransferQuota(TransferLimits.WORKING, "archive.working-limit", "Archive processing exceeds the 1 GiB temporary-storage budget. No records imported.")
        private val closed = AtomicBoolean(false)
        private data class Variant(val policy: Int, val variant: ImageVariant, val mime: String, val width: Int, val height: Int)
        private val variants = mutableMapOf<String, List<Variant>>()
        override fun names() = files.keys.toSet()
        private fun fail(code: String, message: String): Nothing = throw TransferFailure(Failure.Invalid(code, message))
        private fun output(name: String, limit: Long): OutputStream {
            check(!closed.get() && name !in files)
            val path = Files.createTempFile(root, "entry-", ".bin")
            files[name] = path
            return object : FilterOutputStream(Files.newOutputStream(path)) {
                val quota = TransferQuota(limit, "archive.limit", "Archive entry or file exceeds its permitted size.")
                override fun write(b: Int) = write(byteArrayOf(b.toByte()), 0, 1)
                override fun write(b: ByteArray, off: Int, len: Int) {
                    quota.consume(len.toLong()); working.consume(len.toLong())
                    out.write(b, off, len)
                }
            }
        }
        override fun stage(name: String, input: InputStream, limit: Long) { output(name, limit).use { input.copyTo(it, 32 * 1024) } }
        override fun input(name: String): InputStream = Files.newInputStream(files.getValue(name))
        override fun unpack(input: InputStream, manifestLimit: Int, maxImages: Int): ByteArray {
            stage("input.zip", input, TransferLimits.ARCHIVE)
            val extracted = TransferQuota(TransferLimits.ARCHIVE, "archive.limit", "Extracted archive exceeds 256 MiB. No records imported.")
            var count = 0
            ZipFile(files.getValue("input.zip").toFile()).use { zip ->
                val entries = zip.entries()
                while (entries.hasMoreElements()) {
                    val entry = entries.nextElement(); count++
                    require(count <= maxImages + 1 && !entry.isDirectory && entry.method in setOf(ZipEntry.STORED, ZipEntry.DEFLATED))
                    require(entry.name == "manifest.json" || entry.name.matches(Regex("images/[a-f0-9]{64}")))
                    require(entry.name !in files)
                    val limit = if (entry.name == "manifest.json") manifestLimit.toLong() else ImageLimits.ORIGINAL_BYTES.toLong()
                    zip.getInputStream(entry).use { source ->
                        val crc = CRC32(); var entryBytes = 0L
                        output(entry.name, limit).use { target ->
                            val buffer = ByteArray(32 * 1024)
                            while (true) {
                                val size = source.read(buffer); if (size < 0) break
                                extracted.consume(size.toLong())
                                entryBytes += size; crc.update(buffer, 0, size)
                                target.write(buffer, 0, size)
                            }
                        }
                        require(crc.value == entry.crc && entryBytes == entry.size)
                    }
                }
            }
            require("manifest.json" in files)
            return input("manifest.json").use { it.readBytes() }
        }
        override fun stageImage(image: ProcessedImage) {
            val hash = image.metadata.hash
            if ("images/$hash" !in files) image.original.stream().use { stage("images/$hash", it, ImageLimits.ORIGINAL_BYTES.toLong()) }
            check(image.derivatives.all { it.policy == ImageLimits.POLICY })
            image.derivatives.forEach { d -> d.content.stream().use { stage("derived/$hash/${d.variant}", it, ImageLimits.DERIVATIVE_BYTES.toLong()) } }
            // Keep only metadata in memory; image bytes are read individually during the final transaction.
            variants[hash] = image.derivatives.map { Variant(it.policy, it.variant, it.mime, it.width, it.height) }
        }
        override fun image(metadata: ImageMetadata): ProcessedImage {
            val hash = metadata.hash
            val original = input("images/$hash").use { ImageBytes(it.readBytes()) }
            val ds = variants.getValue(hash).map { d -> ImageDerivative(d.policy, d.variant, d.mime, d.width, d.height, input("derived/$hash/${d.variant}").use { ImageBytes(it.readBytes()) }) }
            return ProcessedImage(metadata, original, ds)
        }
        override fun pack(): PortableDownload {
            val entries = files.keys.filter { it == "manifest.json" || it.startsWith("images/") }
            require("manifest.json" in entries)
            if (entries.sumOf { Files.size(files.getValue(it)) } > TransferLimits.ARCHIVE) fail("archive.limit", "Extracted archive exceeds 256 MiB; select fewer records.")
            ZipOutputStream(output("output.zip", TransferLimits.ARCHIVE)).use { zip ->
                entries.sorted().forEach { name ->
                    zip.putNextEntry(ZipEntry(name).apply { time = 0 })
                    input(name).use { it.copyTo(zip, 32 * 1024) }; zip.closeEntry()
                }
            }
            return object : PortableDownload {
                override val size get() = Files.size(files.getValue("output.zip"))
                override fun input() = this@Workspace.input("output.zip")
                override fun close() = this@Workspace.close()
            }
        }
        override fun close() {
            if (closed.compareAndSet(false, true)) {
                try { Files.walk(root).use { paths -> paths.sorted(Comparator.reverseOrder()).forEach(Files::deleteIfExists) } }
                finally { release() }
            }
        }
    }
    companion object { private val slot = Semaphore(1) }
}
