package workbench.sources.api

import arrow.core.Either
import workbench.platform.api.Failure
import java.util.UUID

interface Sources {
    fun select(campaign: UUID, capture: UUID, path: String, section: String?): Either<Failure, SelectedSource>
}
data class SelectedSource(
    val campaign: UUID, val capture: UUID, val path: String, val section: String?, val title: String,
    val markdown: String, val documentHash: String, val contentHash: String, val anchors: Map<String, String>,
    val classification: SourceClassification = SourceClassification(),
    val relationships: List<SourceRelationship> = emptyList(),
    val bodyStart: Int = 0
)
