package workbench.sources.api

import arrow.core.Either
import workbench.platform.api.Failure
import java.util.UUID

interface Sources {
    fun catalogue(campaign: UUID): Either<Failure, SourceCatalogue>
    fun select(campaign: UUID, capture: UUID, path: String, section: String?): Either<Failure, SelectedSource>
    fun authoringLibrary(campaign: UUID): Either<Failure, AuthoringLibrary>
}
/** Captured evidence, including declared IDs suppressed from invalid classification. Never scans files. */
data class SourceCatalogue(val campaign: UUID, val capture: UUID?, val documents: List<CatalogueSource>)
data class CatalogueSource(val path: String, val raw: String, val declaredId: UUID?, val hash: String, val document: SourceDocument)
data class AuthoringLibrary(val capture: UUID?, val documents: Map<String, String>)
data class SelectedSource(
    val campaign: UUID, val capture: UUID, val path: String, val section: String?, val title: String,
    val markdown: String, val documentHash: String, val contentHash: String, val anchors: Map<String, String>,
    val classification: SourceClassification = SourceClassification(),
    val relationships: List<SourceRelationship> = emptyList(),
    val bodyStart: Int = 0
)
