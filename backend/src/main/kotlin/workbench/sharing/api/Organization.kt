package workbench.sharing.api

import arrow.core.Either
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.Failure
import java.util.UUID

data class SharedPile(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val name: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val cover: UUID?)
/** Source and anchor describe intent against the current collection, never a replacement array. */
data class OrganizeCollection(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val kind: String,
    val pile: UUID? = null, val name: String? = null, val card: UUID? = null,
    val source: UUID? = null, val before: UUID? = null, val confirmed: Boolean = false)

interface PlayerOrganization {
    fun organizeGroup(campaign: UUID, credential: String?, request: OrganizeCollection): Either<Failure, SharedCollection>
    fun organize(campaign: UUID, credential: String?, request: OrganizeCollection): Either<Failure, SharedCollection>
}
