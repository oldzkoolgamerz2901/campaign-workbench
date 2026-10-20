package workbench.preparation.adapter.web

import arrow.core.flatMap
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.media.*
import org.springframework.web.bind.annotation.*
import org.springframework.http.ResponseEntity
import tools.jackson.databind.ObjectMapper
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.PreparationService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sessions", produces = ["application/json"])
class PreparationController(private val service: PreparationService, private val mapper: ObjectMapper, private val archiveReader: SessionArchiveReader) {
    @Operation(operationId = "listSessions")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionList::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @GetMapping
    fun list(@PathVariable campaign: UUID) = service.list(campaign).response()
    @Operation(operationId = "createSession")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionData::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PostMapping
    fun create(@PathVariable campaign: UUID, @RequestBody request: CreateSession) = service.create(campaign, request).response()
    @Operation(operationId = "openSession")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionData::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @GetMapping("/{id}")
    fun open(@PathVariable campaign: UUID, @PathVariable id: UUID) = service.open(campaign, id).response()
    @Operation(operationId = "saveSession")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionData::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PutMapping("/{id}")
    fun save(@PathVariable campaign: UUID, @PathVariable id: UUID, @RequestBody request: SaveSession) = service.save(campaign, id, request).response()
    @Operation(operationId = "addSessionSource")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionData::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PostMapping("/{id}/sources")
    fun add(@PathVariable campaign: UUID, @PathVariable id: UUID, @RequestBody request: AddSource) = service.add(campaign, id, request).response()
    @Operation(operationId = "addSessionDraft")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionData::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PostMapping("/{id}/drafts")
    fun addDraft(@PathVariable campaign: UUID, @PathVariable id: UUID, @RequestBody request: AddDraft) = service.addDraft(campaign, id, request).response()
    @Operation(operationId = "renderSession")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionView::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @GetMapping("/{id}/rendered")
    fun view(@PathVariable campaign: UUID, @PathVariable id: UUID) = service.view(campaign, id).response()
    @Operation(operationId = "previewMarkdown")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = RenderedMarkdown::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PostMapping("/preview")
    fun preview(@PathVariable campaign: UUID, @RequestBody request: MarkdownInput) = service.preview(request).response()
    @Operation(operationId = "exportSessions")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = Archive::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PostMapping("/export")
    fun export(@PathVariable campaign: UUID, @RequestBody request: ExportSessions): ResponseEntity<*> = service.export(campaign, request).fold(
        { arrow.core.Either.Left(it).response() },
        { if (mapper.writeValueAsBytes(it).size > MAX_ARCHIVE) arrow.core.Either.Left(Failure.Invalid("preparation.archive-size", "Archive exceeds 20 MiB; select fewer sessions.")).response()
          else ResponseEntity.ok().header("Content-Disposition", "attachment; filename=prepared-sessions.json").body(it) })
    @Operation(operationId = "importSessions")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionList::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = Archive::class))])
    @PostMapping("/import", consumes = ["application/json"])
    fun import(@PathVariable campaign: UUID, request: jakarta.servlet.http.HttpServletRequest): ResponseEntity<*> {
        val bytes = request.inputStream.readNBytes(MAX_ARCHIVE + 1)
        if (bytes.size > MAX_ARCHIVE) return arrow.core.Either.Left(Failure.Invalid("preparation.archive-size", "Archive exceeds 20 MiB. No sessions imported.")).response()
        return archiveReader.read(bytes).flatMap { service.import(campaign, it) }.response()
    }
    companion object { const val MAX_ARCHIVE = SessionArchiveReader.MAX_ARCHIVE }
}
