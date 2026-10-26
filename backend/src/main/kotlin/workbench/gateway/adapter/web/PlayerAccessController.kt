package workbench.gateway.adapter.web

import arrow.core.Either
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.*
import workbench.gateway.adapter.tomcat.PlayerRoutes
import workbench.gateway.application.GatewayService
import workbench.platform.api.*
import workbench.sharing.api.*
import java.util.UUID

@RestController
@RequestMapping("/player-api", produces = ["application/json"])
@ApiResponse(responseCode = "401", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "403", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class PlayerAccessController(private val access: PlayerAccess) {
    @Operation(operationId = "redeemPlayerPairing")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PairingResult::class))])
    @PostMapping("/pair", consumes = ["application/json"])
    fun redeem(request: HttpServletRequest, @RequestBody pairing: RedeemPairing) =
        admitted(request) { access.redeem(it, pairing.token) }.response(noStore = true)

    @Operation(operationId = "identifyPairedPlayer")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PlayerIdentity::class))])
    @GetMapping("/me")
    fun identify(request: HttpServletRequest, @RequestHeader(name = "Authorization", required = false) authorization: String?) =
        admitted(request) { access.identify(it, authorization?.let { header -> bearer.matchEntire(header)?.groupValues?.get(1) }) }.response(noStore = true)

    private fun <T> admitted(request: HttpServletRequest, call: (UUID) -> Either<Failure, T>): Either<Failure, T> {
        val operation = request.getAttribute(PlayerRoutes.OPERATION) as? GatewayService.Operation
            ?: return Either.Left(Failure.Conflict("gateway.not-admitted", "Use the enabled player gateway."))
        return call(operation.campaign)
    }
    private val bearer = Regex("Bearer ([A-Za-z0-9_-]{43})", RegexOption.IGNORE_CASE)
}
