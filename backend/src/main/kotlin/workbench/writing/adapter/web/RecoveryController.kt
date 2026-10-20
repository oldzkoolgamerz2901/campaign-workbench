package workbench.writing.adapter.web

import arrow.core.Either
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.media.*
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.ResponseEntity
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.writing.api.*
import workbench.writing.application.*
import java.util.UUID

@RestController
@RequestMapping("/api/writing-recovery", produces = ["application/json"])
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class RecoveryController(private val recovery: RecoveryService) {
    @GetMapping
    @Operation(operationId = "listRecoveryWorkspaces")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = RecoveryList::class))])
    fun list() = recovery.list()

    @PostMapping(consumes = ["application/octet-stream"])
    @Operation(operationId = "restoreWritingArchive")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "application/octet-stream", schema = Schema(type = "string", format = "binary"))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = RecoverySummary::class))])
    fun restore(request: HttpServletRequest) = recovery.restore(request.inputStream.readNBytes(RECOVERY_BYTES + 1)).response()

    @GetMapping("/campaigns/{campaign}/archive", produces = ["application/octet-stream"])
    @Operation(operationId = "downloadWritingArchive")
    @ApiResponse(responseCode = "200", content = [Content(mediaType = "application/octet-stream", schema = Schema(type = "string", format = "binary"))])
    fun backup(@PathVariable campaign: UUID) = download(recovery.backup(campaign), "writing-recovery.json")

    @GetMapping("/{id}")
    @Operation(operationId = "getRecoveryWorkspace")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = RecoveryIndex::class))])
    fun index(@PathVariable id: UUID) = recovery.index(id).response()

    @GetMapping("/{id}/records")
    @Operation(operationId = "getRecoveryRecord")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = RecoveryDetail::class))])
    fun detail(@PathVariable id: UUID, @RequestParam key: String) = recovery.detail(id, key).response()

    @GetMapping("/{id}/archive", produces = ["application/octet-stream"])
    @Operation(operationId = "downloadRecoveredArchive")
    @ApiResponse(responseCode = "200", content = [Content(mediaType = "application/octet-stream", schema = Schema(type = "string", format = "binary"))])
    fun archive(@PathVariable id: UUID) = download(recovery.archive(id), "recovered-writing.json")

    @GetMapping("/{id}/markdown", produces = ["text/markdown"])
    @Operation(operationId = "downloadRecoveredMarkdown")
    @ApiResponse(responseCode = "200", content = [Content(mediaType = "text/markdown", schema = Schema(type = "string", format = "binary"))])
    fun markdown(@PathVariable id: UUID, @RequestParam key: String): ResponseEntity<*> = recovery.detail(id, key).fold(
        { Either.Left(it).response() }, { d ->
            if (d.record.kind != "export" || d.markdown == null) Either.Left(Failure.Invalid("writing.recovery-record", "Select a retained export to download its original Markdown.")).response()
            else ResponseEntity.ok().contentType(MediaType("text", "markdown", Charsets.UTF_8))
                .header("Content-Disposition", "attachment; filename=recovered-export.md").header("X-Content-SHA256", d.hash.orEmpty()).body(d.markdown.toByteArray(Charsets.UTF_8))
        })

    @PostMapping("/{id}/copies")
    @Operation(operationId = "copyRecoveredDraft")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftData::class))])
    fun copy(@PathVariable id: UUID, @RequestBody request: CopyRecovery) = recovery.copy(id, request).response()

    private fun download(result: Either<Failure, ByteArray>, name: String): ResponseEntity<*> = result.fold(
        { Either.Left(it).response() }, { ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).header("Content-Disposition", "attachment; filename=$name").body(it) })
}
