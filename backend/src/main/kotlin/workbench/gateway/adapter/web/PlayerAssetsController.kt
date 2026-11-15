package workbench.gateway.adapter.web

import io.swagger.v3.oas.annotations.Hidden
import org.springframework.core.io.FileSystemResource
import org.springframework.http.*
import org.springframework.web.bind.annotation.*
import jakarta.servlet.http.HttpServletRequest
import workbench.gateway.adapter.http.PlayerAssets
import java.net.NetworkInterface
import java.net.Inet4Address
import workbench.gateway.api.GatewayStatus
import workbench.gateway.application.GatewayService

@Hidden
@RestController
class PlayerAssetsController(private val assets: PlayerAssets) {
    @GetMapping("/player/**")
    fun asset(request: HttpServletRequest): ResponseEntity<*> {
        val file=assets.resource(request.requestURI) ?: return ResponseEntity.notFound().build<Void>()
        val type=when(file.fileName.toString().substringAfterLast('.')) {
            "html" -> "text/html;charset=UTF-8"
            "js" -> "text/javascript;charset=UTF-8"
            "css" -> "text/css;charset=UTF-8"
            "svg" -> "image/svg+xml"
            "png" -> "image/png"
            "ico" -> "image/x-icon"
            "woff" -> "font/woff"
            "woff2" -> "font/woff2"
            "ttf" -> "font/ttf"
            else -> return ResponseEntity.notFound().build<Void>()
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(type)).cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options","nosniff").body(FileSystemResource(file))
    }
}

data class LanAddress(val address: String,val label: String)
data class GatewayAccess(val gateway: GatewayStatus,val addresses: List<LanAddress>,val playerAssetsReady: Boolean)

@RestController
class GatewayAccessController(private val gateway: GatewayService,private val assets: PlayerAssets,
    @org.springframework.beans.factory.annotation.Value("\${workbench.gateway.address:0.0.0.0}") private val bind: String) {
    @io.swagger.v3.oas.annotations.Operation(operationId="getGatewayAccess")
    @GetMapping("/api/gateway/access",produces=["application/json"])
    fun access(): GatewayAccess {
        val addresses=try {
            NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback }.flatMap { adapter ->
                adapter.inetAddresses.toList().filterIsInstance<Inet4Address>()
                    .filter { !it.isLoopbackAddress && !it.isLinkLocalAddress && (bind=="0.0.0.0" || bind==it.hostAddress) }
                    .map { LanAddress(it.hostAddress,adapter.displayName ?: adapter.name) }
            }.distinctBy { it.address }.sortedBy { it.address }
        } catch (_: java.net.SocketException) { emptyList() }
        return GatewayAccess(gateway.status(),addresses,assets.ready())
    }
}
