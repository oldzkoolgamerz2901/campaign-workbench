package workbench.playthroughs.domain

import java.util.UUID

data class PlayWorkspace(val session: UUID, val revision: Long, val active: List<UUID>, val used: List<UUID>) {
    fun valid(membership: List<UUID>): Boolean {
        val all = active + used
        return revision >= 0 && all.size == all.distinct().size && all.toSet() == membership.toSet()
    }
    fun reconcile(membership: List<UUID>): PlayWorkspace {
        val known = (active + used).toSet()
        val members = membership.toSet()
        val next = copy(active = membership.filter { it !in known } + active.filter { it in members }, used = used.filter { it in members })
        return if (next == this) this else next.copy(revision = revision + 1)
    }
}
