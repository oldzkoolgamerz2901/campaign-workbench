package workbench.preparation.api

import io.swagger.v3.oas.annotations.media.Schema
import workbench.writing.api.LibraryEntry
import java.util.UUID

/** Catalogue representation and destination revision captured before the action starts. */
data class AddLibraryCard(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val key: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val capture: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val draft: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val draftRevision: Long?
)
enum class SessionCardState { READY, ALREADY_PREPARED, UPDATE_AVAILABLE, BLOCKED }
data class PreparedCardMatch(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val item: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val updateAvailable: Boolean,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val canUpdate: Boolean
)
data class SessionLibraryEntry(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val entry: LibraryEntry,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val state: SessionCardState,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val matches: List<PreparedCardMatch>
)
data class SessionLibrary(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val capture: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val entries: List<SessionLibraryEntry>
)
/** All matches are returned in preparation order; clients explicitly choose historical duplicates. */
data class LibraryAddResult(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: SessionData,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val added: Boolean,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val items: List<UUID>
)
