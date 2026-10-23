package workbench.writing.api

import arrow.core.Either
import workbench.platform.api.*
import workbench.sources.api.*
import java.util.UUID

/** Path/declaredId are the current locator; capture/hash retain the review baseline.
 * Association evidence survives working-Draft deletion; provenance remains in immutable snapshots. */
data class SourceAssociationData(val card: UUID, val path: String, val declaredId: UUID?, val capture: UUID, val hash: String)
data class EditLibrarySource(val capture: UUID, val path: String)
data class LibrarySourceState(val path: String, val capture: UUID?, val declaredId: UUID?, val state: String, val hash: String?)
data class LibraryEntry(
    val key: String, val card: UUID?, val draft: UUID?, val revision: Long?, val title: String,
    val classification: SourceClassification, val image: ImageMetadata?, val sources: List<LibrarySourceState>,
    val conflicts: List<String>, val ready: Boolean
)
data class CardLibrary(val campaign: UUID, val capture: UUID?, val entries: List<LibraryEntry>)
data class LibraryDocument(
    val entry: LibraryEntry, val markdown: String, val source: SourceDocument?, val draftPreview: DraftPreview?, val draft: DraftData?
)
interface CardLibraries {
    fun list(campaign: UUID, query: String = "", filter: SourceFilter = SourceFilter()): Either<Failure, CardLibrary>
    /** Match the catalogue representation: Draft ID and revision together, or both null for a Source. */
    fun document(campaign: UUID, key: String, capture: UUID?, revision: Long?, sourcePath: String? = null, draft: UUID? = null): Either<Failure, LibraryDocument>
    fun editSource(campaign: UUID, request: EditLibrarySource): Either<Failure, DraftData>
}
