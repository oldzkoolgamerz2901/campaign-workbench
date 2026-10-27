package workbench.sharing

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.campaigns.api.Campaigns
import workbench.platform.api.Transactions
import workbench.sharing.application.*
import workbench.sharing.adapter.security.RandomDeviceSecrets
import java.time.Duration
import java.time.Instant

@Configuration
class SharingConfiguration {
    @Bean fun distributionService(campaigns: Campaigns, prepared: workbench.preparation.api.PreparedCards, players: SharingStore, cards: SharedCardStore, tx: Transactions, clock: SharingClock) = DistributionService(campaigns,prepared,players,cards,tx,clock)
    @Bean fun collectionService(identity: workbench.sharing.api.PlayerAccess, cards: SharedCardStore, tx: Transactions, layouts: workbench.sources.api.CardLayoutCalculator) = CollectionService(identity,cards,tx,layouts)
    @Bean fun sharingClock() = SharingClock { Instant.now() }
    @Bean fun deviceSecrets(): DeviceSecrets = RandomDeviceSecrets()
    @Bean fun sharingService(campaigns: Campaigns, store: SharingStore, tx: Transactions, clock: SharingClock, secrets: DeviceSecrets,
        @Value("\${workbench.sharing.invitation-lifetime-seconds:300}") seconds: Long) = SharingService(campaigns, store, tx, clock, secrets, Duration.ofSeconds(seconds))
}
