package workbench.sharing.application

import workbench.platform.api.*
import workbench.preparation.api.PreparedCard
import workbench.sharing.api.*
import java.time.Instant
import java.util.UUID

interface SharedCardStore {
    fun retained(campaign: UUID, card: UUID): RemovedSharedCard?
    fun removed(campaign: UUID): List<RemovedSharedCard>
    fun transition(campaign: UUID, card: UUID, recipient: UUID?, state: String, kind: String, now: Instant): SharedCardData
    fun operation(campaign: UUID, operation: UUID): Pair<DistributeCard, UUID>?
    fun insert(campaign: UUID, request: DistributeCard, source: PreparedCard, now: Instant): SharedCardData
    fun cards(campaign: UUID, recipient: UUID?): List<SharedCardData>
    fun card(campaign: UUID, card: UUID): Pair<UUID?, SharedCardData>?
    fun artwork(campaign: UUID, card: UUID): ImageDerivative?
}
