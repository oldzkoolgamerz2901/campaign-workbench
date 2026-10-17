package workbench.campaigns.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.ProblemResponse
import org.springframework.web.bind.annotation.*
import workbench.campaigns.api.*
import workbench.campaigns.application.CampaignService
import workbench.platform.api.response
import java.util.UUID

@RestController
@ApiResponse(responseCode = "500", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@RequestMapping("/api/campaigns", produces = ["application/json"])
class CampaignController(private val campaigns: CampaignService) {
    @Operation(operationId = "listCampaigns")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = CampaignList::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @GetMapping
    fun list() = campaigns.list().response()
    @Operation(operationId = "registerCampaign")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = Campaign::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PostMapping
    fun register(@RequestBody request: RegisterCampaign) = campaigns.register(request).response()
    @Operation(operationId = "configureCampaign")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = Campaign::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PutMapping("/{id}/configuration")
    fun configure(@PathVariable id: UUID, @RequestBody request: ConfigureCampaign) = campaigns.configure(id, request).response()
    @Operation(operationId = "selectCampaign")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = Campaign::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PutMapping("/{id}/selection")
    fun select(@PathVariable id: UUID) = campaigns.select(id).response()
}
