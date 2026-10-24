package workbench.sessionarchives

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.preparation.api.PreparationTransfers
import workbench.playthroughs.api.WorkspaceTransfers
import workbench.sessionarchives.application.*

@Configuration
class SessionArchiveConfiguration {
    @Bean fun portableSessionService(preparation: PreparationTransfers, workspaces: WorkspaceTransfers, transfers: PortableTransfers,
        codec: SessionArchiveCodec, processor: ImageProcessor, tx: Transactions, campaigns: Campaigns, notes: workbench.playthroughs.api.PlayNoteTransfers) =
        PortableSessionService(preparation, workspaces, transfers, codec, processor, tx, campaigns, notes)
}
