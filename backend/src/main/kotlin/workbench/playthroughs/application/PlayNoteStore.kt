package workbench.playthroughs.application

import workbench.playthroughs.api.*
import java.util.UUID

data class StoredPlayNote(val note: PlayNoteData, val operation: UUID? = null, val creation: CreatePlayNote? = null)
interface PlayNoteStore {
    fun history(campaign: UUID, reference: ResourceReference, scene: Boolean, pinnedOnly: Boolean,
        limit: Int, beforeTime: java.time.Instant?, beforeId: UUID?): List<StoredPlayNote>
    fun list(session: UUID): List<StoredPlayNote>
    fun get(session: UUID, id: UUID): StoredPlayNote?
    fun operation(session: UUID, operation: UUID): StoredPlayNote?
    fun count(session: UUID): Long
    fun put(record: StoredPlayNote)
}
