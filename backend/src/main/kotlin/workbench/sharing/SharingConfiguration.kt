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
    @Bean fun organizationService(campaigns: Campaigns, identity: workbench.sharing.api.PlayerAccess, cards: SharedCardStore, piles: PileStore, tx: Transactions) = OrganizationService(campaigns,identity,cards,piles,tx)
    @Bean fun cardLifecycleService(campaigns: Campaigns, identity: workbench.sharing.api.PlayerAccess, players: SharingStore, cards: SharedCardStore, tx: Transactions, clock: SharingClock, piles: PileStore) = CardLifecycleService(campaigns,identity,players,cards,tx,clock,piles)
    @Bean fun distributionService(campaigns: Campaigns, prepared: workbench.preparation.api.PreparedCards, players: SharingStore, cards: SharedCardStore, tx: Transactions, clock: SharingClock, piles: PileStore) = DistributionService(campaigns,prepared,players,cards,tx,clock,piles)
    @Bean fun collectionService(identity: workbench.sharing.api.PlayerAccess, cards: SharedCardStore, tx: Transactions, layouts: workbench.sources.api.CardLayoutCalculator, piles: PileStore) = CollectionService(identity,cards,tx,layouts,piles)
    @Bean fun sharingClock() = SharingClock { Instant.now() }
    @Bean fun deviceSecrets(): DeviceSecrets = RandomDeviceSecrets()
    @Bean fun sharingService(campaigns: Campaigns, store: SharingStore, tx: Transactions, clock: SharingClock, secrets: DeviceSecrets,
        @Value("\${workbench.sharing.invitation-lifetime-seconds:300}") seconds: Long) = SharingService(campaigns, store, tx, clock, secrets, Duration.ofSeconds(seconds))
}
