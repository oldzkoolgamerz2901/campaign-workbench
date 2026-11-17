package workbench.sharing.api

import io.swagger.v3.oas.annotations.media.Schema

/** Frozen distributed content, independent of layout requests and live prepared cards. */
data class SharedCardContent(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String = "",
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val type: String = "",
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val summary: String = "",
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val tags: List<String> = emptyList(),
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val backText: String = "",
    val quote: String = "",
    @get:com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) val stats: SharedStats? = null
)
