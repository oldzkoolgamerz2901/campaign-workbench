package workbench.preparation.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.media.*
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.PreparationService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sessions", produces = ["application/json"])
class PreparationController(private val service: PreparationService) {
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
}
