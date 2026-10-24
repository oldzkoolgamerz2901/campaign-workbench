package workbench.sources.api

import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID

data class DecodedAuthoring(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val legacy: Boolean,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val body: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val retainedEnvelope: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val type: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val tags: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val summary: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val issues: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val errors: List<String>,
    val card: UUID? = null
)
data class EncodedAuthoring(val markdown: String, val preview: AuthoredPreview, val errors: List<String>)
data class AuthoredTarget(val id: UUID, val revision: Long, val path: String, val body: String)
/** Pure interpretation input. The composing owner supplies identity, aliases and conflicts. */
data class AuthoredLinkTarget(val key: String, val paths: Set<String>, val markdown: String,
    val draft: UUID? = null, val revision: Long? = null, val conflict: Boolean = false)
data class CheckedLink(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val key: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val destination: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val kind: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val anchor: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val section: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val external: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val draft: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val warning: String?
)
