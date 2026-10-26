package workbench.campaigns.api

import arrow.core.Either
import workbench.platform.api.Failure
import java.util.UUID
import io.swagger.v3.oas.annotations.media.Schema

data class Campaign(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val name: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val directory: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val includes: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val excludes: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long
)

data class CampaignList(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaigns: List<Campaign>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val selected: UUID?
)

data class RegisterCampaign(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val name: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val directory: String
)

data class ConfigureCampaign(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val includes: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val excludes: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long
)

interface Campaigns {
    fun configuration(id: UUID): Either<Failure, Campaign>
}

/** Application coordination contract; selection HTTP is owned by the gateway coordinator. */
interface CampaignSelection {
    fun selected(): Either<Failure, UUID?>
    fun select(id: UUID): Either<Failure, Campaign>
}
