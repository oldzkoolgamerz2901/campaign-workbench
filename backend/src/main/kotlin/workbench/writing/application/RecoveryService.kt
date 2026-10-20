package workbench.writing.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.sources.api.Authoring
import workbench.writing.api.*
import workbench.writing.domain.*
import java.time.Instant
import java.util.UUID

class RecoveryService(private val campaigns: Campaigns, private val drafts: DraftStore, private val source: RecoverySource,
    private val store: RecoveryStore, private val codec: RecoveryCodec, private val authoring: Authoring, private val tx: Transactions) {
    private val validation = RecoveryValidation(authoring)
    private fun invalid() = Failure.Invalid("writing.recovery-invalid", "Invalid, unsupported or oversized Writing archive. No recovery workspace created. Limits: 64 MiB, 1,000 current drafts and 10,000 retained records.")
    private fun missing() = Failure.NotFound("writing.recovery-not-found", "Recovery workspace or record not found.")
    private fun <T> checked(block: () -> T): Either<Failure, T> = try { Either.Right(block()) } catch (_: Exception) { Either.Left(invalid()) }
    fun backup(campaign: UUID): Either<Failure, ByteArray> = tx.run { either {
        val c = campaigns.configuration(campaign).bind()
        // Allow JSONB whitespace overhead in the storage preflight. The codec independently enforces
        // the exact 64 MiB wire cap, and approved enumeration omits stored rendering entirely.
        val size = source.size(campaign)
        ensure(size.drafts <= 1000 && size.retained <= 10000 && size.bytes <= RECOVERY_BYTES * 2L) { invalid() }
        val archive = WritingArchive("workbench-writing-recovery", 1, campaign, c.name, Instant.now().toString(), drafts.list(campaign).map(::draftData),
            source.approved(campaign), source.exports(campaign))
        checked { validation.validate(archive); codec.write(archive) }.bind()
    } }
    fun restore(bytes: ByteArray): Either<Failure, RecoverySummary> = either {
        val archive = checked { codec.read(bytes).also(validation::validate) }.bind()
        tx.run { either {
            val summary = RecoverySummary(UUID.randomUUID(), archive.name, Instant.now().toString(), archive.drafts.size, archive.approved.size, archive.exports.size)
            store.put(summary, archive); summary
        } }.bind()
    }
    fun list(): RecoveryList = RecoveryList(store.list())
    fun archive(id: UUID): Either<Failure, ByteArray> = either { val a = ensureNotNull(store.get(id)) { missing() }; checked { codec.write(a) }.bind() }
    private fun records(a: WritingArchive) = a.drafts.map { RecoveryRecord("draft:${it.id}", "draft", it.id, it.revision, it.fields.title, it.fields.type) } +
        a.approved.map { r -> r.snapshot.let { RecoveryRecord("approved:${it.id}:${it.revision}", "approved", it.id, it.revision, it.fields.title, it.fields.type) } } +
        a.exports.map { r -> r.snapshot.let { RecoveryRecord("export:${r.id}", "export", it.id, it.revision, it.fields.title, it.fields.type) } }
    fun index(id: UUID): Either<Failure, RecoveryIndex> = either {
        val a = ensureNotNull(store.get(id)) { missing() }; RecoveryIndex(ensureNotNull(store.summary(id)) { missing() }, records(a))
    }
    fun detail(id: UUID, key: String): Either<Failure, RecoveryDetail> = either {
        val a = ensureNotNull(store.get(id)) { missing() }
        val r = ensureNotNull(records(a).find { it.key == key }) { missing() }
        val d = when (r.kind) {
            "draft" -> a.drafts.single { it.id == r.draft }
            "approved" -> a.approved.single { it.snapshot.id == r.draft && it.snapshot.revision == r.revision }.snapshot
            else -> a.exports.single { "export:${it.id}" == key }.snapshot
        }
        val approved = a.approved.find { "approved:${it.snapshot.id}:${it.snapshot.revision}" == key }
        val export = a.exports.find { "export:${it.id}" == key }
        RecoveryDetail(r, d, validation.encoded(d).preview, approved?.markdown ?: export?.report?.markdown,
            approved?.hash ?: export?.report?.hash, approved?.links ?: export?.report?.links.orEmpty(), export?.createdAt, export?.report, export?.acknowledged)
    }
    fun copy(id: UUID, request: CopyRecovery): Either<Failure, DraftData> = tx.run { either {
        val a = ensureNotNull(store.get(id)) { missing() }
        val d = ensureNotNull(a.drafts.find { it.id == request.draft }) { missing() }
        campaigns.configuration(request.campaign).bind()
        ensure(drafts.list(request.campaign).size < 1000) { Failure.Invalid("writing.draft-limit", "Destination campaign has reached the 1,000 draft limit.") }
        val f = d.fields
        val origin = d.origin?.let { DraftOrigin(it.campaign, it.capture, it.path, it.card, it.raw, it.hash, it.retainedEnvelope, it.issues, it.interpretation) }
        val copied = Draft(UUID.randomUUID(), request.campaign, UUID.randomUUID(), 0, f.title, f.type, f.status, f.tags, f.summary, f.body, f.path, origin,
            RecoveryOrigin(id, d.campaign, d.id, d.card, d.revision))
        drafts.put(copied); draftData(copied)
    } }
}
