package workbench.writing.api

import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID
import workbench.sources.api.CheckedLink

data class DraftOriginData(
    val campaign: UUID, val capture: UUID, val path: String, val card: UUID?, val raw: String, val hash: String,
    val retainedEnvelope: String, val issues: List<String>, val interpretation: Int
)
data class ForkDraft(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val capture: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String,
    val type: String? = null
)
data class InspectExport(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val capture: UUID?
)
data class CreateExport(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val capture: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fingerprint: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val acknowledgeWarnings: Boolean
)
data class ExportInspection(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val capture: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val markdown: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val hash: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fingerprint: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val errors: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val warnings: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val links: List<CheckedLink>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val targetRevisions: Map<String, Long>
)
data class ExportData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val draft: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val createdAt: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val report: ExportInspection,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val acknowledged: Boolean
)
data class ExportSummary(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val createdAt: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val hash: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val warnings: List<String>
)
data class ExportList(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val artifacts: List<ExportSummary>)
