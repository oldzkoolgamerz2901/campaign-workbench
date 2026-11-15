package workbench.preparation.api

import arrow.core.Either
import workbench.platform.api.*
import workbench.sources.api.CardLayoutInput
import java.util.UUID

/** Distribution input only; never a player response. Joins the caller's campaign transaction. */
data class PreparedCard(val visible: CardLayoutInput, val artwork: ProcessedImage?, val provenance: PreparedCardProvenance)
/** Identity evidence only: excludes source bodies, authored originals, notes and document links. */
data class PreparedCardProvenance(val campaign: UUID, val session: UUID, val item: UUID, val capture: UUID?,
    val path: String, val section: String?, val documentHash: String, val contentHash: String, val kind: String,
    val draft: UUID?, val card: UUID?, val revision: Long?, val approval: UUID?)
interface PreparedCards {
    fun card(campaign: UUID, session: UUID, item: UUID): Either<Failure, PreparedCard>
}
