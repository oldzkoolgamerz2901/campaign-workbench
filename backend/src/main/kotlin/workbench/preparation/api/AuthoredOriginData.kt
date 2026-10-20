package workbench.preparation.api

import java.util.UUID
import io.swagger.v3.oas.annotations.media.Schema

data class AddDraft(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val draft: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val draftRevision: Long
)
data class AuthoredOriginData(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val draft: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val card: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val approval: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val approvedAt: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val original: String?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val originalHash: String?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val originalCampaign: UUID?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val originalCapture: UUID?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val originalPath: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val links: List<FrozenLinkData>)
data class FrozenLinkData(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val destination: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val kind: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val path: String?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val anchor: String?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val section: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val capture: UUID?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val draft: UUID?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val revision: Long?)
