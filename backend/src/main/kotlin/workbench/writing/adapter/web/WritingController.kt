package workbench.writing.adapter.web

import arrow.core.Either
import arrow.core.flatMap
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.parameters.RequestBody
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.*
import org.springframework.http.ContentDisposition
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import tools.jackson.databind.ObjectMapper
import workbench.platform.api.*
import workbench.writing.api.*
import workbench.writing.application.WritingService
import workbench.writing.application.WritingExportService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/drafts", produces = ["application/json"])
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class WritingController(private val service: WritingService, private val exports: WritingExportService, private val mapper: ObjectMapper) {
    private fun <T> read(request: HttpServletRequest, type: Class<T>): Either<Failure, T> {
        val bytes = request.inputStream.readNBytes(10 * 1024 * 1024 + 1)
        if (bytes.size > 10 * 1024 * 1024) return Either.Left(Failure.Invalid("writing.request-size", "Draft request exceeds 10 MiB. Working edits are not saved."))
        return try { Either.Right(mapper.readValue(bytes, type)) } catch (_: Exception) { Either.Left(Failure.Invalid("writing.request", "Invalid draft request.")) }
    }
    @GetMapping
    @Operation(operationId = "listDrafts")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftList::class))])
    fun list(@PathVariable campaign: UUID) = service.list(campaign).response()

    @PostMapping
    @Operation(operationId = "createDraft")
    @RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = CreateDraft::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftData::class))])
    fun create(@PathVariable campaign: UUID, request: HttpServletRequest) = read(request, CreateDraft::class.java).flatMap { service.create(campaign, it) }.response()

    @GetMapping("/{id}")
    @Operation(operationId = "openDraft")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftData::class))])
    fun open(@PathVariable campaign: UUID, @PathVariable id: UUID) = service.open(campaign, id).response()

    @PutMapping("/{id}")
    @Operation(operationId = "saveDraft")
    @RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = SaveDraft::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftData::class))])
    fun save(@PathVariable campaign: UUID, @PathVariable id: UUID, request: HttpServletRequest) = read(request, SaveDraft::class.java).flatMap { service.save(campaign, id, it) }.response()

    @DeleteMapping("/{id}", produces = ["application/json", "application/problem+json"])
    @Operation(operationId = "deleteDraft")
    @ApiResponse(responseCode = "204", description = "Working draft deleted; retained history and prepared copies are unchanged.")
    fun delete(@PathVariable campaign: UUID, @PathVariable id: UUID, @RequestParam revision: Long): ResponseEntity<*> = service.delete(campaign, id, revision).fold(
        { Either.Left(it).response() }, { ResponseEntity.noContent().build<Void>() })

    @PostMapping("/{id}/preview")
    @Operation(operationId = "previewDraft")
    @RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = DraftFields::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftPreview::class))])
    fun preview(@PathVariable campaign: UUID, @PathVariable id: UUID, request: HttpServletRequest) = read(request, DraftFields::class.java).flatMap { service.preview(campaign, id, it) }.response()

    @PostMapping("/fork")
    @Operation(operationId = "forkDraft")
    @RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = ForkDraft::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftData::class))])
    fun fork(@PathVariable campaign: UUID, request: HttpServletRequest) = read(request, ForkDraft::class.java).flatMap { exports.fork(campaign, it) }.response()

    @PostMapping("/{id}/export-inspection")
    @Operation(operationId = "inspectDraftExport")
    @RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = InspectExport::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = ExportInspection::class))])
    fun inspectExport(@PathVariable campaign: UUID, @PathVariable id: UUID, request: HttpServletRequest) = read(request, InspectExport::class.java).flatMap { exports.inspect(campaign, id, it) }.response()

    @PostMapping("/{id}/exports")
    @Operation(operationId = "createDraftExport")
    @RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = CreateExport::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = ExportData::class))])
    fun createExport(@PathVariable campaign: UUID, @PathVariable id: UUID, request: HttpServletRequest) = read(request, CreateExport::class.java).flatMap { exports.create(campaign, id, it) }.response()

    @GetMapping("/{id}/exports")
    @Operation(operationId = "listDraftExports")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = ExportList::class))])
    fun history(@PathVariable campaign: UUID, @PathVariable id: UUID) = exports.history(campaign, id).response()

    @GetMapping("/{id}/exports/{artifact}/markdown", produces = ["text/markdown"])
    @Operation(operationId = "downloadDraftExport")
    @ApiResponse(responseCode = "200", content = [Content(mediaType = "text/markdown", schema = Schema(type = "string", format = "binary"))])
    fun download(@PathVariable campaign: UUID, @PathVariable id: UUID, @PathVariable artifact: UUID): ResponseEntity<*> = exports.artifact(campaign, id, artifact).fold(
        { Either.Left(it).response() },
        { saved -> ResponseEntity.ok()
            .contentType(MediaType("text", "markdown", Charsets.UTF_8))
            .header("Content-Disposition", ContentDisposition.attachment().filename(saved.snapshot.path.substringAfterLast('/'), Charsets.UTF_8).build().toString())
            .header("X-Content-SHA256", saved.hash)
            .body(saved.markdown.toByteArray(Charsets.UTF_8)) }
    )
}
