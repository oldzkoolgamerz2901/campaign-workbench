package workbench.sharing.application

import workbench.sharing.api.SharedPile
import java.util.UUID

interface PileStore {
    fun piles(campaign: UUID, recipient: UUID?): List<SharedPile>
    fun create(campaign: UUID, recipient: UUID?, name: String): UUID
    fun rename(campaign: UUID, pile: UUID, name: String)
    fun order(campaign: UUID, ids: List<UUID>)
    fun cover(campaign: UUID, pile: UUID, card: UUID?)
    fun move(campaign: UUID, recipient: UUID?, card: UUID, pile: UUID?, before: UUID?)
    fun delete(campaign: UUID, pile: UUID)
}
