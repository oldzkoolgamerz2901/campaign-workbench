package workbench.preparation.api

import arrow.core.Either
import workbench.platform.api.*
import java.util.UUID

/** Frozen membership and provenance. Caller joins the campaign transaction before composing snapshots. */
interface PreparedSessions {
    fun snapshot(campaign: UUID, session: UUID): Either<Failure, SessionData>
}

/** Preparation's content/image part of an atomic session transfer; no runtime table state lives here. */
interface PreparationTransfers : PreparedSessions {
    fun exportContents(campaign: UUID, request: ExportSessions, illustrated: Boolean): Either<Failure, Archive>
    fun validateContents(archive: Archive, illustrated: Boolean): Either<Failure, Unit>
    fun importContents(campaign: UUID, archive: Archive, illustrated: Boolean): Either<Failure, SessionList>
    fun imageMetadata(campaign: UUID, hash: String): ImageMetadata?
    fun imageOriginal(campaign: UUID, hash: String): ImageBytes?
    fun putImage(campaign: UUID, image: ProcessedImage)
}

/** Exact captured target resolution, implemented with the reader in the contextual-suggestions increment. */
enum class PreparedTargetState { MATCHED, AMBIGUOUS, UNPREPARED, UNAVAILABLE }
data class PreparedTarget(val item: UUID, val anchor: String?)
data class PreparedTargetCandidates(val state: PreparedTargetState, val candidates: List<PreparedTarget>)
interface PreparedTargets {
    fun candidates(campaign: UUID, session: UUID, originItem: UUID, linkKey: String): Either<Failure, PreparedTargetCandidates>
}
