package workbench.preparation

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.api.Campaigns
import workbench.sources.api.Sources
import workbench.platform.api.Transactions
import workbench.preparation.application.*

@Configuration
class PreparationConfiguration {
    @Bean fun preparationService(campaigns: Campaigns, sources: Sources, store: SessionStore, tx: Transactions, markdown: PreparationMarkdown) = PreparationService(campaigns, sources, store, tx, markdown)
}
