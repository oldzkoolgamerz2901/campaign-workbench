package workbench.writing.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.*
import io.swagger.v3.oas.annotations.responses.ApiResponse
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.writing.api.RecoverySummary
import workbench.writing.application.PortableWritingService
import java.util.UUID

@RestController
@RequestMapping("/api/writing-recovery")
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class PortableWritingController(private val service: PortableWritingService) {
    @GetMapping("/campaigns/{campaign}/portable-archive", produces = ["application/zip"])
    @Operation(operationId = "downloadPortableWritingArchive")
    @ApiResponse(responseCode = "200", content = [Content(mediaType = "application/zip", schema = Schema(type = "string", format = "binary"))])
    fun backup(@PathVariable campaign: UUID) = service.backup(campaign).downloadResponse("writing-recovery.zip")

    @GetMapping("/{id}/portable-archive", produces = ["application/zip"])
    @Operation(operationId = "downloadPortableRecoveredArchive")
    @ApiResponse(responseCode = "200", content = [Content(mediaType = "application/zip", schema = Schema(type = "string", format = "binary"))])
    fun archive(@PathVariable id: UUID) = service.archive(id).downloadResponse("recovered-writing.zip")

    @PostMapping("/portable-import", consumes = ["application/octet-stream"], produces = ["application/json"])
    @Operation(operationId = "restorePortableWritingArchive")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "application/octet-stream", schema = Schema(type = "string", format = "binary"))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = RecoverySummary::class))])
    fun restore(request: HttpServletRequest) = service.restore(request.inputStream).response()
}
