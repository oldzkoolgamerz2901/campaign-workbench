package workbench.sharing.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.sharing.api.*
import workbench.sharing.application.DistributionService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sharing")
class DistributionController(private val service: DistributionService) {
    @Operation(operationId="previewSharedCard")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCardPreview::class))])
    @PostMapping("/preview",consumes=["application/json"],produces=["application/json"])
    fun preview(@PathVariable campaign: UUID,@RequestBody request: PreviewSharedCard)=service.preview(campaign,request).response(noStore=true)

    @Operation(operationId="previewSharedArtwork")
    @PostMapping("/preview/artwork",consumes=["application/json"],produces=["image/jpeg","image/png"])
    @ApiResponse(responseCode="200",content=[Content(mediaType="image/jpeg",schema=Schema(type="string",format="binary"))])
    fun previewArtwork(@PathVariable campaign: UUID,@RequestBody request: DistributeCard)=image(service.previewArtwork(campaign,request))

    @Operation(operationId="distributeSharedCard")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCardData::class))])
    @PostMapping("/cards",consumes=["application/json"],produces=["application/json"])
    fun distribute(@PathVariable campaign: UUID,@RequestBody request: DistributeCard)=service.distribute(campaign,request).response(noStore=true)

    @Operation(operationId="getSharedCollection")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCollection::class))])
    @GetMapping("/collection",produces=["application/json"])
    fun collection(@PathVariable campaign: UUID,@RequestParam(required=false) recipient: UUID?)=service.collection(campaign,recipient).response(noStore=true)

    @Operation(operationId="getSharedArtwork")
    @ApiResponse(responseCode="200",content=[Content(mediaType="image/jpeg",schema=Schema(type="string",format="binary"))])
    @GetMapping("/cards/{card}/artwork",produces=["image/jpeg","image/png"])
    fun artwork(@PathVariable campaign: UUID,@PathVariable card: UUID)=image(service.artwork(campaign,card))

    private fun image(result: arrow.core.Either<Failure,ImageDerivative>): ResponseEntity<*> = result.fold(
        { arrow.core.Either.Left(it).response(noStore=true) },
        { ResponseEntity.ok().header("Cache-Control","no-store").header("Content-Type",it.mime).body(it.content.copy()) })
}
