package workbench.playthroughs

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.api.Campaigns
import workbench.platform.api.Transactions
import workbench.preparation.api.PreparedSessions
import workbench.playthroughs.application.*

@Configuration
class PlaythroughConfiguration {
    @Bean fun playthroughService(campaigns: Campaigns, preparation: PreparedSessions, store: WorkspaceStore, tx: Transactions) = PlaythroughService(campaigns, preparation, store, tx)
}
