package workbench.preparation.adapter.web

import arrow.core.Either
import arrow.core.flatMap
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.media.*
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.*
import tools.jackson.databind.ObjectMapper
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.preparation.application.SessionLibraryService
import workbench.sources.api.SourceFilter
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sessions/{id}/library", produces = ["application/json"])
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class SessionLibraryController(private val library: SessionLibraryService, private val mapper: ObjectMapper) {
    @GetMapping
    @Operation(operationId = "listSessionLibraryCards")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionLibrary::class))])
    fun list(@PathVariable campaign: UUID, @PathVariable id: UUID, @RequestParam(defaultValue = "") query: String,
        @RequestParam(required = false) types: Set<String>?, @RequestParam(required = false) tags: Set<String>?,
        @RequestParam(required = false) purposes: Set<String>?, @RequestParam(required = false) statuses: Set<String>?,
        @RequestParam(defaultValue = "false") unclassified: Boolean, @RequestParam(defaultValue = "false") issues: Boolean) =
        library.list(campaign, id, query, SourceFilter(types.orEmpty(), tags.orEmpty(), purposes.orEmpty(), statuses.orEmpty(), unclassified, issues)).response()

    @PostMapping
    @Operation(operationId = "addSessionLibraryCard", description = "Atomically reuse/create an associated Draft, approve its exact saved revision and freeze a whole card. Existing whole-card matches are all returned without updating content or checking the old session/Draft revision; capture and identity conflicts still apply. New membership requires exact session and catalogue expectations.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = AddLibraryCard::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = LibraryAddResult::class))])
    fun add(@PathVariable campaign: UUID, @PathVariable id: UUID, request: HttpServletRequest) = read(request).flatMap { library.add(campaign, id, it) }.response()

    @PutMapping("/{item}")
    @Operation(operationId = "replacePreparedLibraryCard", description = "Explicitly replace a whole prepared item with the selected saved Draft version of the same logical card and type. Preserve item identity, order and notes. Session revision, capture, Draft ID and Draft revision must match.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = AddLibraryCard::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SessionData::class))])
    fun replace(@PathVariable campaign: UUID, @PathVariable id: UUID, @PathVariable item: UUID, request: HttpServletRequest) = read(request).flatMap { library.replace(campaign, id, item, it) }.response()

    private fun read(request: HttpServletRequest): Either<Failure, AddLibraryCard> {
        val bytes = request.inputStream.readNBytes(65537)
        if (bytes.size > 65536) return Either.Left(Failure.Invalid("preparation.request-size", "Library mutation request exceeds 64 KiB."))
        return try { Either.Right(mapper.readValue(bytes, AddLibraryCard::class.java)) }
        catch (_: Exception) { Either.Left(Failure.Invalid("preparation.request", "Invalid Library mutation request.")) }
    }
}
