package workbench.sharing.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.platform.api.ProblemResponse
import workbench.platform.api.response
import workbench.sharing.api.*
import workbench.sharing.application.SharingService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sharing", produces = ["application/json"])
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "403", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class SharingController(private val sharing: SharingService) {
    @Operation(operationId = "listCampaignPlayers")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = CampaignPlayers::class))])
    @GetMapping("/players")
    fun players(@PathVariable campaign: UUID) = sharing.players(campaign).response(noStore = true)

    @Operation(operationId = "addCampaignPlayer")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = CampaignPlayerData::class))])
    @PostMapping("/players", consumes = ["application/json"])
    fun add(@PathVariable campaign: UUID, @RequestBody request: AddCampaignPlayer) = sharing.add(campaign, request).response(noStore = true)

    @Operation(operationId = "setCampaignPlayerActive")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = CampaignPlayerData::class))])
    @PutMapping("/players/{player}/active", consumes = ["application/json"])
    fun active(@PathVariable campaign: UUID, @PathVariable player: UUID, @RequestBody request: SetCampaignPlayerActive) =
        sharing.activate(campaign, player, request.active).response(noStore = true)

    @Operation(operationId = "issuePlayerPairing")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PairingInvitationData::class))])
    @PostMapping("/players/{player}/pairing", consumes = ["application/json"])
    fun invite(@PathVariable campaign: UUID, @PathVariable player: UUID) = sharing.invite(campaign, player).response(noStore = true)

    @Operation(operationId = "listPlayerDevices")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PlayerDevices::class))])
    @GetMapping("/players/{player}/devices")
    fun devices(@PathVariable campaign: UUID, @PathVariable player: UUID) = sharing.devices(campaign, player).response(noStore = true)

    @Operation(operationId = "revokePlayerDevice")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DeviceData::class))])
    @PostMapping("/devices/{device}/revoke", consumes = ["application/json"])
    fun revoke(@PathVariable campaign: UUID, @PathVariable device: UUID) = sharing.revoke(campaign, device).response(noStore = true)
}
