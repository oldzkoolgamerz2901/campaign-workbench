package workbench.preparation.domain

import java.util.UUID
import workbench.platform.api.ImageMetadata

data class Provenance(val campaign: UUID, val capture: UUID?, val path: String, val section: String?, val documentHash: String, val contentHash: String, val kind: String = "source", val authored: AuthoredOrigin? = null)
data class PreparedItem(val id: UUID, val title: String, val markdown: String, val provenance: Provenance, val anchors: Map<String, String>, val notes: String, val capturedSource: CapturedSource? = null, val image: ImageMetadata? = null)
data class Session(val id: UUID, val campaign: UUID, val revision: Long, val title: String, val objective: String, val notes: String, val items: List<PreparedItem>, val table: CardTable? = null)

/** Null means the table has never been opened; preparation order remains the starting order. */
data class CardTable(val active: List<UUID>, val used: List<UUID>) {
    fun reconcile(items: List<PreparedItem>): CardTable {
        val ids = items.map { it.id }.toSet()
        val known = (active + used).toSet()
        return CardTable(items.map { it.id }.filter { it !in known } + active.filter { it in ids }, used.filter { it in ids })
    }
    fun valid(items: List<PreparedItem>): Boolean {
        val all = active + used
        return all.size == all.distinct().size && all.toSet() == items.map { it.id }.toSet()
    }
}
