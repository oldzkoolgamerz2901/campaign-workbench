package workbench.campaigns.application

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.raise.ensure
import arrow.core.raise.ensureNotNull
import workbench.campaigns.api.*
import workbench.campaigns.domain.PathRules
import workbench.platform.api.Failure
import workbench.platform.api.Transactions
import java.util.UUID

class CampaignService(private val store: CampaignStore, private val directories: DirectoryAccess, private val tx: Transactions) : Campaigns {
    fun list(): Either<Failure, CampaignList> = tx.run { either { store.list() } }
    override fun configuration(id: UUID): Either<Failure, Campaign> = tx.run { either {
        ensureNotNull(store.lock(id)) { Failure.NotFound("campaign.not-found", "Campaign not found.") }
    } }
    fun register(request: RegisterCampaign): Either<Failure, Campaign> = either {
        ensure(request.name.isNotBlank() && request.name.length <= 200) { Failure.Invalid("campaign.name", "Enter a campaign name of at most 200 characters.") }
        val directory = directories.resolve(request.directory).bind()
        tx.run { either {
            val campaign = Campaign(UUID.randomUUID(), request.name.trim(), directory, PathRules.defaultIncludes, PathRules.defaultExcludes, 0)
            ensure(store.add(campaign)) { Failure.Conflict("campaign.duplicate", "This directory is already registered.") }
            campaign
        } }.bind()
    }
    fun configure(id: UUID, request: ConfigureCampaign): Either<Failure, Campaign> = tx.run { either {
        ensure(request.includes.isNotEmpty() && (request.includes + request.excludes).all(PathRules::valid)) {
            Failure.Invalid("campaign.filters", "Provide include patterns using relative paths and *, ?, or **. Exclusions take precedence.")
        }
        val old = ensureNotNull(store.lock(id)) { Failure.NotFound("campaign.not-found", "Campaign not found.") }
        ensure(old.revision == request.revision) { Failure.Conflict("campaign.configuration-conflict", "Configuration changed; reload it before saving.") }
        old.copy(includes = request.includes, excludes = request.excludes, revision = old.revision + 1).also(store::save)
    } }
    fun select(id: UUID): Either<Failure, Campaign> = tx.run { either {
        val campaign = ensureNotNull(store.get(id)) { Failure.NotFound("campaign.not-found", "Campaign not found.") }
        store.select(id); campaign
    } }
}
