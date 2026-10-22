package workbench.preparation

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.api.Campaigns
import workbench.sources.api.Sources
import workbench.platform.api.Transactions
import workbench.preparation.application.*

@Configuration
class PreparationConfiguration {
    @Bean fun portableSessionService(preparation: PreparationService, images: PreparationImageStore, transfers: workbench.platform.api.PortableTransfers, codec: SessionArchiveCodec, processor: workbench.platform.api.ImageProcessor, tx: Transactions, campaigns: Campaigns) = PortableSessionService(preparation, images, transfers, codec, processor, tx, campaigns)
    @Bean fun preparedArtworkService(preparation: PreparationService, images: PreparationImageStore, tx: Transactions) = PreparedArtworkService(preparation, images, tx)
    @Bean fun preparationService(campaigns: Campaigns, sources: Sources, store: SessionStore, tx: Transactions, markdown: PreparationMarkdown, writing: workbench.writing.api.SessionDrafts, images: PreparationImageStore) = PreparationService(campaigns, sources, store, tx, markdown, writing, images)
}
