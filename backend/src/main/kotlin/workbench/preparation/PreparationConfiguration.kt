package workbench.preparation

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.api.Campaigns
import workbench.sources.api.Sources
import workbench.platform.api.Transactions
import workbench.preparation.application.*

@Configuration
class PreparationConfiguration {
    @Bean fun sessionLibraryService(campaigns: Campaigns, library: workbench.writing.api.CardLibraries, preparation: PreparationService, tx: Transactions) = SessionLibraryService(campaigns, library, preparation, tx)
    @Bean fun preparationTransfers(service: PreparationService, images: PreparationImageStore) = PreparationTransferFacade(service, images)
    @Bean fun preparedArtworkService(preparation: PreparationService, images: PreparationImageStore, tx: Transactions) = PreparedArtworkService(preparation, images, tx)
    @Bean fun preparationService(campaigns: Campaigns, sources: Sources, store: SessionStore, tx: Transactions, markdown: PreparationMarkdown, writing: workbench.writing.api.SessionDrafts, images: PreparationImageStore) = PreparationService(campaigns, sources, store, tx, markdown, writing, images)
}
