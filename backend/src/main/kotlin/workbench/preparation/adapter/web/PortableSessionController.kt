package workbench.preparation.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.*
import io.swagger.v3.oas.annotations.responses.ApiResponse
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.PortableSessionService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sessions")
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class PortableSessionController(private val service: PortableSessionService) {
    @PostMapping("/portable-export", consumes = ["application/json"], produces = ["application/zip"])
    @Operation(operationId = "exportPortableSessions")
    @ApiResponse(responseCode = "200", content = [Content(mediaType = "application/zip", schema = Schema(type = "string", format = "binary"))])
    fun export(@PathVariable campaign: UUID, @RequestBody request: ExportSessions) = service.export(campaign, request).downloadResponse("prepared-sessions.zip")

    @PostMapping("/portable-import", consumes = ["application/octet-stream"], produces = ["application/json"])
    @Operation(operationId = "importPortableSessions")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "application/octet-stream", schema = Schema(type = "string", format = "binary"))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionList::class))])
    fun import(@PathVariable campaign: UUID, request: HttpServletRequest) = service.import(campaign, request.inputStream).response()
}
