package workbench.sources

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.api.Campaigns
import workbench.platform.api.Transactions
import workbench.sources.application.*

@Configuration
class SourceConfiguration {
    @Bean fun cardLayoutCalculator(fonts: workbench.platform.api.FontMeasurements): workbench.sources.api.CardLayoutCalculator = CardLayouts(fonts)
    @Bean fun sourceService(campaigns: Campaigns, store: CaptureStore, scanner: SourceScanner, markdown: Markdown, tx: Transactions) = SourceService(campaigns, store, scanner, markdown, tx)
}
