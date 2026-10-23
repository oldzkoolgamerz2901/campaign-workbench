package workbench.writing

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.api.Campaigns
import workbench.sources.api.Authoring
import workbench.sources.api.Sources
import workbench.platform.api.Transactions
import workbench.writing.application.*

@Configuration
class WritingConfiguration {
    @Bean fun cardLibraries(campaigns: Campaigns, sources: Sources, authoring: Authoring, drafts: DraftStore, associations: SourceAssociationStore, exports: ExportStore, tx: Transactions): workbench.writing.api.CardLibraries = CardLibraryService(campaigns, sources, authoring, drafts, associations, exports, tx)
    @Bean fun portableWritingService(recovery: RecoveryService, images: WritingImageStore, transfers: workbench.platform.api.PortableTransfers, codec: RecoveryCodec, processor: workbench.platform.api.ImageProcessor, tx: Transactions) = PortableWritingService(recovery, images, transfers, codec, processor, tx)
    @Bean fun artworkService(campaigns: Campaigns, drafts: DraftStore, revisions: ApprovedRevisionStore, exports: ExportStore, recovery: RecoveryService, images: WritingImageStore, tx: Transactions) = ArtworkService(campaigns, drafts, revisions, exports, recovery, images, tx)
    @Bean fun recoveryService(campaigns: Campaigns, drafts: DraftStore, source: RecoverySource, store: RecoveryStore, codec: RecoveryCodec, authoring: Authoring, tx: Transactions, images: WritingImageStore) = RecoveryService(campaigns, drafts, source, store, codec, authoring, tx, images)
    @Bean fun sessionDrafts(campaigns: Campaigns, drafts: DraftStore, revisions: ApprovedRevisionStore, authoring: Authoring, sources: Sources, tx: Transactions, images: WritingImageStore): workbench.writing.api.SessionDrafts = SessionDraftService(campaigns, drafts, revisions, authoring, sources, tx, images)
    @Bean fun writingService(campaigns: Campaigns, store: DraftStore, authoring: Authoring, tx: Transactions, sources: Sources, images: WritingImageStore, processor: workbench.platform.api.ImageProcessor) = WritingService(campaigns, store, authoring, tx, sources, images, processor)
    @Bean fun writingExportService(campaigns: Campaigns, store: DraftStore, exports: ExportStore, authoring: Authoring, sources: Sources, tx: Transactions) = WritingExportService(campaigns, store, exports, authoring, sources, tx)
}
