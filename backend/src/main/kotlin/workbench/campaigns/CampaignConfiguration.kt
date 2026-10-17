package workbench.campaigns

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.application.*
import workbench.platform.api.Transactions

@Configuration
class CampaignConfiguration {
    @Bean fun campaignService(store: CampaignStore, directories: DirectoryAccess, tx: Transactions) = CampaignService(store, directories, tx)
}
