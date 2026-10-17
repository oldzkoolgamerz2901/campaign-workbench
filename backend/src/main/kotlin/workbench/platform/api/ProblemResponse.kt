package workbench.platform.api

import io.swagger.v3.oas.annotations.media.Schema

// OpenAPI shape of the Problem Details produced by the web adapters.
data class ProblemResponse(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val type: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val status: Int,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val detail: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val code: String,
    val correlationId: String? = null,
)
