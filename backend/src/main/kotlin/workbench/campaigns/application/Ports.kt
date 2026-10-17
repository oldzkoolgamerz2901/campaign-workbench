package workbench.campaigns.application

import workbench.campaigns.api.Campaign
import workbench.campaigns.api.CampaignList
import arrow.core.Either
import workbench.platform.api.Failure
import java.util.UUID

interface CampaignStore {
    fun list(): CampaignList
    fun get(id: UUID): Campaign?
    fun lock(id: UUID): Campaign?
    fun add(campaign: Campaign): Boolean
    fun save(campaign: Campaign)
    fun select(id: UUID)
}
interface DirectoryAccess { fun resolve(directory: String): Either<Failure, String> }
