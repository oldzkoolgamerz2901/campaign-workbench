package workbench.playthroughs.domain

import java.util.UUID

data class PlayWorkspace(
    val session: UUID, val revision: Long, val active: List<UUID>, val used: List<UUID>,
    val activeSceneItemId: UUID? = null, val focusedItemIds: List<UUID> = emptyList()
) {
    fun valid(membership: List<UUID>, scenes: Set<UUID> = emptySet()): Boolean {
        val all = active + used
        return revision >= 0 && all.size == all.distinct().size && all.toSet() == membership.toSet() &&
            focusedItemIds.size <= 3 && focusedItemIds.distinct().size == focusedItemIds.size &&
            membership.containsAll(focusedItemIds) && (activeSceneItemId == null || (activeSceneItemId in scenes && activeSceneItemId in membership))
    }
    fun reconcile(membership: List<UUID>, scenes: Set<UUID> = emptySet()): PlayWorkspace {
        val known = (active + used).toSet()
        val members = membership.toSet()
        val next = copy(
            active = membership.filter { it !in known } + active.filter { it in members },
            used = used.filter { it in members },
            activeSceneItemId = activeSceneItemId?.takeIf { it in members && it in scenes },
            focusedItemIds = focusedItemIds.filter { it in members }
        )
        return if (next == this) this else next.copy(revision = revision + 1)
    }
}
