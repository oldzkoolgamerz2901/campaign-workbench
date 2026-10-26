package workbench.gateway

import jakarta.servlet.DispatcherType
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory
import org.springframework.boot.web.server.WebServerFactoryCustomizer
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.Ordered
import workbench.campaigns.api.CampaignSelection
import workbench.gateway.adapter.tomcat.*
import workbench.gateway.application.GatewayService
import java.net.InetAddress
import workbench.gateway.adapter.http.PlayerAssets
import java.nio.file.Path
import tools.jackson.databind.ObjectMapper

@Configuration
class GatewayConfiguration {
    @Bean fun playerAssets(@Value("\${workbench.gateway.player-assets:frontend/dist/player/browser}") directory: String, mapper: ObjectMapper) = PlayerAssets(Path.of(directory),mapper)
    @Bean fun gatewayListener(@Value("\${workbench.gateway.address:0.0.0.0}") address: String,
                              @Value("\${workbench.gateway.port:8081}") port: Int) = TomcatGatewayListener(address, port)
    @Bean(destroyMethod = "shutdown")
    fun gatewayService(selection: CampaignSelection, listener: TomcatGatewayListener,
                       @Value("\${workbench.gateway.drain-timeout-ms:5000}") drainMillis: Long) = GatewayService(selection, listener, drainMillis)
    @Bean fun gatewayTomcat(listener: TomcatGatewayListener, gateway: GatewayService, assets: PlayerAssets) =
        WebServerFactoryCustomizer<TomcatServletWebServerFactory> { factory ->
            // A configuration override must not accidentally expose the private API.
            factory.setAddress(InetAddress.getByName("127.0.0.1"))
            factory.addEngineValves(PlayerBoundary(listener, gateway, assets))
        }
    @Bean fun playerDispatchBoundary(assets: PlayerAssets) = FilterRegistrationBean(PlayerDispatchBoundary(assets)).apply {
        setDispatcherTypes(java.util.EnumSet.allOf(DispatcherType::class.java))
        addUrlPatterns("/*")
        order = Ordered.HIGHEST_PRECEDENCE
        isAsyncSupported = true
    }
}
