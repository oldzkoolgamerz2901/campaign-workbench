package workbench.writing.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import org.springframework.web.bind.annotation.*
import arrow.core.Either
import arrow.core.flatMap
import jakarta.servlet.http.HttpServletRequest
import tools.jackson.databind.ObjectMapper
import workbench.platform.api.*
import workbench.sources.api.SourceFilter
import workbench.writing.api.*
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/cards", produces = ["application/json"])
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class CardLibraryController(private val library: CardLibraries, private val mapper: ObjectMapper) {
    @GetMapping
    @Operation(operationId = "listLibraryCards")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = CardLibrary::class))])
    fun list(@PathVariable campaign: UUID, @RequestParam(defaultValue = "") query: String,
        @RequestParam(required = false) types: Set<String>?, @RequestParam(required = false) tags: Set<String>?,
        @RequestParam(required = false) purposes: Set<String>?, @RequestParam(required = false) statuses: Set<String>?,
        @RequestParam(defaultValue = "false") unclassified: Boolean, @RequestParam(defaultValue = "false") issues: Boolean) =
        library.list(campaign, query, SourceFilter(types.orEmpty(), tags.orEmpty(), purposes.orEmpty(), statuses.orEmpty(), unclassified, issues)).response()

    @GetMapping("/document")
    @Operation(operationId = "readLibraryCard", description = "Send the catalogue's draft ID and revision together for a Draft; omit both for a Source-only card. Stale capture or representation selections return a conflict.")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = LibraryDocument::class))])
    fun document(@PathVariable campaign: UUID, @RequestParam key: String, @RequestParam(required = false) capture: UUID?, @RequestParam(required = false) revision: Long?, @RequestParam(required = false) sourcePath: String?, @RequestParam(required = false) draft: UUID?, @RequestParam(required = false) linkPath: String?) =
        library.document(campaign, key, capture, revision, sourcePath, draft, linkPath).response()

    @PostMapping("/edit-source")
    @Operation(operationId = "editLibrarySource")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "application/json", schema = Schema(implementation = EditLibrarySource::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftData::class))])
    fun edit(@PathVariable campaign: UUID, request: HttpServletRequest) = read(request).flatMap { library.editSource(campaign, it) }.response()

    private fun read(request: HttpServletRequest): Either<Failure, EditLibrarySource> {
        val bytes = request.inputStream.readNBytes(65537)
        if (bytes.size > 65536) return Either.Left(Failure.Invalid("writing.request-size", "Source edit request exceeds 64 KiB."))
        return try { Either.Right(mapper.readValue(bytes, EditLibrarySource::class.java)) }
        catch (_: Exception) { Either.Left(Failure.Invalid("writing.request", "Invalid Source edit request.")) }
    }
}
