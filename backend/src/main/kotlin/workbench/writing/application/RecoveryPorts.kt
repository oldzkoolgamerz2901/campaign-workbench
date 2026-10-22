package workbench.writing.application

import java.util.UUID
import workbench.writing.api.*

/** Preflight storage totals prevent materializing an unbounded campaign history. */
data class RecoverySize(val drafts: Long, val retained: Long, val bytes: Long)
interface RecoverySource {
    fun size(campaign: UUID): RecoverySize
    fun approved(campaign: UUID): List<RecoveryApproval>
    fun exports(campaign: UUID): List<RecoveryExport>
}
interface RecoveryStore {
    fun list(): List<RecoverySummary>
    fun get(id: UUID): WritingArchive?
    fun summary(id: UUID): RecoverySummary?
    fun put(summary: RecoverySummary, archive: WritingArchive)
}
interface RecoveryCodec {
    fun read(bytes: ByteArray): WritingArchive
    fun readIllustrated(bytes: ByteArray): WritingArchive
    fun write(archive: WritingArchive): ByteArray
}
const val RECOVERY_BYTES = 64 * 1024 * 1024
