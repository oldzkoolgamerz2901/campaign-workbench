package workbench.sessionarchives.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.*
import io.swagger.v3.oas.annotations.responses.ApiResponse
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.sessionarchives.application.PortableSessionService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sessions")
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class PortableSessionController(private val service: PortableSessionService, private val codec: workbench.sessionarchives.application.SessionArchiveCodec) {
    @PostMapping("/export", consumes = ["application/json"], produces = ["application/json"])
    @Operation(operationId = "exportSessions")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = workbench.sessionarchives.api.SessionTransfer::class))])
    fun exportJson(@PathVariable campaign: UUID, @RequestBody request: ExportSessions) = service.manifest(campaign, request).response()

    @PostMapping("/import", consumes = ["application/json"], produces = ["application/json"])
    @Operation(operationId = "importSessions")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = workbench.sessionarchives.api.SessionTransfer::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionList::class))])
    fun importJson(@PathVariable campaign: UUID, request: HttpServletRequest): org.springframework.http.ResponseEntity<*> {
        val bytes = request.inputStream.readNBytes(SessionArchiveReader.MAX_ARCHIVE + 1)
        return codec.readTransfer(bytes).fold({ arrow.core.Either.Left(it).response() }, { service.restore(campaign, it).response() })
    }

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
