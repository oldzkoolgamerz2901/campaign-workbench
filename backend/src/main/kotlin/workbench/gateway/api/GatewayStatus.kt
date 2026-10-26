package workbench.gateway.api

import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID

data class GatewayStatus(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val enabled: Boolean,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val campaign: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val port: Int?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val activeRequests: Int
)

data class GatewayReadiness(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val status: String = "ready")
