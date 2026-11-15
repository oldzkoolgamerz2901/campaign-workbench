package workbench.sharing.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.sharing.api.*
import workbench.sharing.application.CardLifecycleService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sharing")
class CardLifecycleController(private val service: CardLifecycleService) {
    @Operation(operationId="transferSharedCard")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCardData::class))])
    @PostMapping("/cards/{card}/transfer",consumes=["application/json"],produces=["application/json"])
    fun transfer(@PathVariable campaign: UUID,@PathVariable card: UUID,@RequestBody request: TransferSharedCard)=service.transfer(campaign,card,request).response(noStore=true)

    @Operation(operationId="removeSharedCard")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCardData::class))])
    @PostMapping("/cards/{card}/remove",consumes=["application/json"],produces=["application/json"])
    fun remove(@PathVariable campaign: UUID,@PathVariable card: UUID)=service.removeByDm(campaign,card).response(noStore=true)

    @Operation(operationId="restoreSharedCard")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCardData::class))])
    @PostMapping("/cards/{card}/restore",consumes=["application/json"],produces=["application/json"])
    fun restore(@PathVariable campaign: UUID,@PathVariable card: UUID)=service.restore(campaign,card).response(noStore=true)

    @Operation(operationId="getRemovedSharedCards")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=RemovedSharedCards::class))])
    @GetMapping("/removed",produces=["application/json"])
    fun removed(@PathVariable campaign: UUID)=service.removed(campaign).response(noStore=true)
}
