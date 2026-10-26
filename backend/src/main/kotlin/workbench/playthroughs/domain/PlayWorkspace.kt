package workbench.playthroughs.domain

import java.util.UUID
import workbench.playthroughs.api.CardLocation

data class RuntimePile(val name: String? = null, val items: List<UUID> = emptyList(), val cover: UUID? = null) {
    fun valid() = (name == null || (name.isNotBlank() && name.length <= 200)) &&
        items.distinct().size == items.size && if (items.isEmpty()) cover == null else cover in items

    fun retaining(members: Set<UUID>): RuntimePile {
        val remaining = items.filter { it in members }
        val nextCover = if (cover in remaining) cover else {
            val start = items.indexOf(cover).coerceAtLeast(0)
            (items.drop(start + 1) + items.take(start + 1)).firstOrNull { it in remaining }
        }
        return copy(items = remaining, cover = nextCover)
    }
}

data class PlayWorkspace(
    val session: UUID, val revision: Long, val sessionCards: List<UUID>, val used: List<UUID>,
    val activeSceneItemId: UUID? = null, val pile1: RuntimePile = RuntimePile(), val pile2: RuntimePile = RuntimePile()
) {
    fun all() = sessionCards + used + pile1.items + pile2.items + listOfNotNull(activeSceneItemId)
    fun valid(membership: List<UUID>, scenes: Set<UUID>): Boolean {
        val all = all()
        return revision >= 0 && all.size == all.distinct().size && all.toSet() == membership.toSet() &&
            pile1.valid() && pile2.valid() && (activeSceneItemId == null || activeSceneItemId in scenes)
    }
    fun reconcile(membership: List<UUID>, scenes: Set<UUID>): PlayWorkspace {
        val members = membership.toSet()
        val additions = membership.filter { it !in all().toSet() }
        val invalidScene = activeSceneItemId?.takeIf { it in members && it !in scenes }
        val next = copy(
            sessionCards = additions + listOfNotNull(invalidScene) + sessionCards.filter { it in members },
            used = used.filter { it in members }, pile1 = pile1.retaining(members), pile2 = pile2.retaining(members),
            activeSceneItemId = activeSceneItemId?.takeIf { it in members && it in scenes }
        )
        return if (next == this) this else next.copy(revision = revision + 1)
    }
    fun items(location: CardLocation) = when (location) {
        CardLocation.SESSION_CARDS -> sessionCards
        CardLocation.USED -> used
        CardLocation.PILE_1 -> pile1.items
        CardLocation.PILE_2 -> pile2.items
    }
    fun withItems(location: CardLocation, ids: List<UUID>): PlayWorkspace = when (location) {
        CardLocation.SESSION_CARDS -> copy(sessionCards = ids)
        CardLocation.USED -> copy(used = ids)
        CardLocation.PILE_1 -> copy(pile1 = pile1.copy(items = ids))
        CardLocation.PILE_2 -> copy(pile2 = pile2.copy(items = ids))
    }
    fun without(id: UUID) = copy(sessionCards = sessionCards - id, used = used - id,
        pile1 = pile1.retaining((pile1.items - id).toSet()), pile2 = pile2.retaining((pile2.items - id).toSet()))

    /** Caller checks membership, Scene protection and insertion bounds before applying. */
    fun move(id: UUID, to: CardLocation, index: Int?): PlayWorkspace {
        val removed = without(id)
        val target = removed.items(to).toMutableList()
        val at = index ?: if (to == CardLocation.PILE_1 || to == CardLocation.PILE_2) target.size else 0
        target.add(at, id)
        val next = removed.withItems(to, target)
        return when (to) {
            CardLocation.PILE_1 -> next.copy(pile1 = next.pile1.copy(cover = next.pile1.cover ?: id))
            CardLocation.PILE_2 -> next.copy(pile2 = next.pile2.copy(cover = next.pile2.cover ?: id))
            else -> next
        }
    }
}
