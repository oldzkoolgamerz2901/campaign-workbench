package workbench.preparation.domain

import java.util.UUID

data class AuthoredOrigin(val draft: UUID, val card: UUID, val revision: Long, val approval: UUID, val approvedAt: String,
    val original: String?, val originalHash: String?, val originalCampaign: UUID?, val originalCapture: UUID?, val originalPath: String?,
    val links: List<FrozenLink>)
data class FrozenLink(val destination: String, val kind: String, val path: String?, val anchor: String?, val section: String?,
    val capture: UUID?, val draft: UUID?, val revision: Long?)
