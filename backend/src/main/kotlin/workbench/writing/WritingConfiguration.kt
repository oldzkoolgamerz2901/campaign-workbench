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
    @Bean fun recoveryService(campaigns: Campaigns, drafts: DraftStore, source: RecoverySource, store: RecoveryStore, codec: RecoveryCodec, authoring: Authoring, tx: Transactions) = RecoveryService(campaigns, drafts, source, store, codec, authoring, tx)
    @Bean fun sessionDrafts(campaigns: Campaigns, drafts: DraftStore, revisions: ApprovedRevisionStore, authoring: Authoring, sources: Sources, tx: Transactions): workbench.writing.api.SessionDrafts = SessionDraftService(campaigns, drafts, revisions, authoring, sources, tx)
    @Bean fun writingService(campaigns: Campaigns, store: DraftStore, authoring: Authoring, tx: Transactions, sources: Sources) = WritingService(campaigns, store, authoring, tx, sources)
    @Bean fun writingExportService(campaigns: Campaigns, store: DraftStore, exports: ExportStore, authoring: Authoring, sources: Sources, tx: Transactions) = WritingExportService(campaigns, store, exports, authoring, sources, tx)
}
