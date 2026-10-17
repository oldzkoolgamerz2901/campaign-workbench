package workbench.sources.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import workbench.platform.api.ProblemResponse
import workbench.sources.api.*
import org.springframework.web.bind.annotation.*
import workbench.sources.application.SourceService
import workbench.platform.api.response
import java.util.UUID

@RestController
@ApiResponse(responseCode = "500", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@RequestMapping("/api/campaigns/{id}/sources", produces = ["application/json"])
class SourceController(private val sources: SourceService) {
    @Operation(operationId = "getLibrary")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = Library::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @GetMapping
    fun library(@PathVariable id: UUID) = sources.library(id).response()
    @Operation(operationId = "refreshLibrary")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = Library::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @PostMapping("/refresh")
    fun refresh(@PathVariable id: UUID) = sources.refresh(id).response()
    @Operation(operationId = "getSourceDocument")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SourceDocument::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @GetMapping("/document")
    fun document(@PathVariable id: UUID, @RequestParam capture: UUID, @RequestParam path: String) = sources.document(id, capture, path).response()
    @Operation(operationId = "searchSources")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SearchResults::class))])
    @ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
    @GetMapping("/search")
    fun search(@PathVariable id: UUID, @RequestParam capture: UUID, @RequestParam query: String) = sources.search(id, capture, query).response()
}
