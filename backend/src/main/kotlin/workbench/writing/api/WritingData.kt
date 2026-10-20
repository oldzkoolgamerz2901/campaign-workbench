package workbench.writing.api

import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID
import workbench.sources.api.AuthoredPreview
import workbench.sources.api.AuthoringCatalog

data class DraftFields(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val type: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val status: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val tags: List<String>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val summary: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val body: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String
)
data class DraftData(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val card: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fields: DraftFields, val origin: DraftOriginData? = null, val recovery: RecoveryOriginData? = null)
data class DraftList(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val drafts: List<DraftData>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val catalog: AuthoringCatalog)
data class CreateDraft(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val type: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val template: Boolean)
data class SaveDraft(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fields: DraftFields)
data class DraftPreview(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val preview: AuthoredPreview, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val pathIssues: List<String>, val checkedLinks: List<workbench.sources.api.CheckedLink> = emptyList(), val capture: UUID? = null)

data class RecoveryOriginData(val workspace: UUID, val campaign: UUID, val draft: UUID, val card: UUID, val revision: Long)
