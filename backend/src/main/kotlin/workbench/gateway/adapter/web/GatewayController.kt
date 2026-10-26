package workbench.gateway.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.campaigns.api.Campaign
import workbench.gateway.api.*
import workbench.gateway.application.GatewayService
import workbench.platform.api.ProblemResponse
import workbench.platform.api.response
import java.util.UUID

@RestController
@ApiResponse(responseCode = "500", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class GatewayController(private val gateway: GatewayService) {
    @Operation(operationId = "getGatewayStatus")
    @GetMapping("/api/gateway", produces = ["application/json"])
    fun status() = gateway.status()

    @Operation(operationId = "enableGateway")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = GatewayStatus::class))])
    @PostMapping("/api/gateway/enable", consumes = ["application/json"], produces = ["application/json"])
    fun enable() = gateway.enable().response()

    @Operation(operationId = "disableGateway")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = GatewayStatus::class))])
    @PostMapping("/api/gateway/disable", consumes = ["application/json"], produces = ["application/json"])
    fun disable() = gateway.disable().response()

    // Preserve the generated CampaignControllerService contract while moving orchestration here.
    @Operation(operationId = "selectCampaign", tags = ["campaign-controller"])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = Campaign::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PutMapping("/api/campaigns/{id}/selection", produces = ["application/json"])
    fun select(@PathVariable id: UUID) = gateway.select(id).response()

    @Operation(operationId = "getPlayerGatewayReadiness")
    @GetMapping("/player-api/readiness", produces = ["application/json"])
    fun readiness() = org.springframework.http.ResponseEntity.ok()
        .cacheControl(org.springframework.http.CacheControl.noStore()).body(GatewayReadiness())
}
