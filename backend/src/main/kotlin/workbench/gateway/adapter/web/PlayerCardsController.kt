package workbench.gateway.adapter.web

import arrow.core.Either
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import workbench.gateway.adapter.http.PlayerRoutes
import workbench.gateway.application.GatewayService
import workbench.platform.api.*
import workbench.sharing.api.*
import workbench.sources.api.CardLayout
import java.util.UUID

@RestController
@RequestMapping("/player-api")
class PlayerCardsController(private val cards: PlayerCards, private val commands: PlayerCardCommands) {
    @Operation(operationId="getPlayerCollections")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=PlayerCollections::class))])
    @GetMapping("/collections",produces=["application/json"])
    fun collections(request: HttpServletRequest,@RequestHeader(name="Authorization",required=false) auth: String?) =
        admitted(request) { cards.collections(it,credential(auth)) }.response(noStore=true)

    @Operation(operationId="getPlayerCardLayout")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=CardLayout::class))])
    @GetMapping("/cards/{card}/layout",produces=["application/json"])
    fun layout(request: HttpServletRequest,@RequestHeader(name="Authorization",required=false) auth: String?,@PathVariable card: UUID) =
        admitted(request) { cards.layout(it,credential(auth),card) }.response(noStore=true)

    @Operation(operationId="getPlayerCardArtwork")
    @ApiResponse(responseCode="200",content=[Content(mediaType="image/jpeg",schema=Schema(type="string",format="binary"))])
    @GetMapping("/cards/{card}/artwork",produces=["image/jpeg","image/png"])
    fun artwork(request: HttpServletRequest,@RequestHeader(name="Authorization",required=false) auth: String?,@PathVariable card: UUID): ResponseEntity<*> =
        admitted(request) { cards.artwork(it,credential(auth),card) }.fold(
            { Either.Left(it).response(noStore=true) },
            { ResponseEntity.ok().header("Cache-Control","no-store").header("Content-Type",it.mime).body(it.content.copy()) })

    @Operation(operationId="claimPlayerCard")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCardData::class))])
    @PostMapping("/cards/{card}/claim",consumes=["application/json"],produces=["application/json"])
    fun claim(request: HttpServletRequest,@RequestHeader(name="Authorization",required=false) auth: String?,@PathVariable card: UUID) =
        admitted(request) { commands.claim(it,credential(auth),card) }.response(noStore=true)

    @Operation(operationId="removePlayerCard")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCardData::class))])
    @PostMapping("/cards/{card}/remove",consumes=["application/json"],produces=["application/json"])
    fun remove(request: HttpServletRequest,@RequestHeader(name="Authorization",required=false) auth: String?,@PathVariable card: UUID) =
        admitted(request) { commands.remove(it,credential(auth),card) }.response(noStore=true)

    private fun credential(auth: String?)=auth?.let { Regex("Bearer ([A-Za-z0-9_-]{43})",RegexOption.IGNORE_CASE).matchEntire(it)?.groupValues?.get(1) }
    private fun <T> admitted(request: HttpServletRequest, call: (UUID)->Either<Failure,T>): Either<Failure,T> {
        val operation=request.getAttribute(PlayerRoutes.OPERATION) as? GatewayService.Operation
            ?: return Either.Left(Failure.Conflict("gateway.not-admitted","Use the enabled player gateway."))
        return call(operation.campaign)
    }
}
