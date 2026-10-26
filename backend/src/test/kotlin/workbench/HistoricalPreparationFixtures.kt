package workbench

import arrow.core.Either
import arrow.core.raise.*
import org.springframework.context.ApplicationContext
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.*
import workbench.preparation.domain.*
import workbench.sources.api.Sources
import java.util.UUID

/** Historical fixture construction only: no supported application action captures Source sections. */
data class HistoricalSource(val revision: Long, val capture: UUID, val path: String, val section: String?)

fun PreparationService.addHistoricalSource(context: ApplicationContext, campaign: UUID, id: UUID,
    request: HistoricalSource): Either<Failure, SessionData> = context.getBean(Transactions::class.java).run { either {
    val current = open(campaign, id).bind()
    ensure(current.revision == request.revision) { Failure.Conflict("test.stale-fixture", "Historical fixture revision changed.") }
    val selected = context.getBean(Sources::class.java).select(campaign, request.capture, request.path, request.section).bind()
    fun workbench.sources.api.SourceClassification.frozen() = CapturedClassification(metadata?.let {
        CapturedCard(it.schema, it.id, it.title, it.type, it.purpose, it.status, it.tags.toList(), it.summary)
    }, issues.map { CapturedIssue(it.code, it.field, it.message, it.severity) })
    val captured = CapturedSource(selected.classification.interpretation, selected.bodyStart,
        selected.classification.frozen(), selected.relationships.map {
            CapturedRelationship(it.key, it.originSection, it.destination,
                CapturedLink(it.target.document, it.target.section, it.target.external, it.target.missing),
                it.classification?.frozen(), it.sceneCandidate)
        })
    val item = PreparedItem(UUID.randomUUID(), selected.title, selected.markdown,
        Provenance(selected.campaign, selected.capture, selected.path, selected.section, selected.documentHash, selected.contentHash),
        selected.anchors, "", captured)
    val data = PreparedItemData(item.id, item.title, item.markdown,
        ProvenanceData(selected.campaign, selected.capture, selected.path, selected.section, selected.documentHash, selected.contentHash),
        item.anchors, item.notes, captured.data())
    validateArchive(Archive(10, listOf(current.copy(items = current.items + data))), illustrated = true).bind()
    val store = context.getBean(SessionStore::class.java)
    val before = store.get(campaign, id)!!
    store.put(before.copy(revision = before.revision + 1, items = before.items + item))
    open(campaign, id).bind()
} }
