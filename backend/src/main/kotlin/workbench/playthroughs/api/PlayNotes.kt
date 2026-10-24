package workbench.playthroughs.api

import arrow.core.Either
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.Failure
import java.time.Instant
import java.util.UUID

data class ResourceReference(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val card: UUID
)
data class ResourceSnapshot(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val reference: ResourceReference?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String
)
data class PlayNoteData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val session: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val markdown: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val scene: ResourceSnapshot?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val resource: ResourceSnapshot?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val createdAt: Instant,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val updatedAt: Instant,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val pinned: Boolean
)
data class PlayNoteList(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val notes: List<PlayNoteData>)
data class CreatePlayNote(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val operation: UUID,
    @param:JsonProperty(value = "expectedScene", required = true)
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val expectedScene: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val markdown: String,
    @param:JsonProperty(value = "resource", required = true)
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val resource: UUID?
)
data class EditPlayNote(
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val markdown: String,
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val pinned: Boolean,
    // False preserves historical context even after its prepared copy has been removed.
    @param:JsonProperty(required = true) @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val changeResource: Boolean,
    @param:JsonProperty(value = "resource", required = true)
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val resource: UUID?
)
interface PlayNotes {
    fun list(campaign: UUID, session: UUID): Either<Failure, PlayNoteList>
    fun create(campaign: UUID, session: UUID, request: CreatePlayNote): Either<Failure, PlayNoteData>
    fun edit(campaign: UUID, session: UUID, note: UUID, request: EditPlayNote): Either<Failure, PlayNoteData>
}
interface PlayNoteTransfers {
    fun snapshot(campaign: UUID, session: UUID): Either<Failure, List<PlayNoteData>>
    fun restore(campaign: UUID, session: UUID, notes: List<PlayNoteData>): Either<Failure, Unit>
    fun validate(notes: List<PlayNoteData>, campaign: UUID, session: UUID): Boolean
}
