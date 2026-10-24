package workbench.playthroughs.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.*
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.playthroughs.api.*
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sessions/{session}/play-notes", produces = ["application/json"])
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class PlayNoteController(private val service: PlayNotes) {
    @GetMapping
    @Operation(operationId = "listPlayNotes")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PlayNoteList::class))])
    fun list(@PathVariable campaign: UUID, @PathVariable session: UUID) = service.list(campaign, session).response()
    @PostMapping
    @Operation(operationId = "createPlayNote")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PlayNoteData::class))])
    fun create(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestBody request: CreatePlayNote) = service.create(campaign, session, request).response()
    @PutMapping("/{note}")
    @Operation(operationId = "editPlayNote")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PlayNoteData::class))])
    fun edit(@PathVariable campaign: UUID, @PathVariable session: UUID, @PathVariable note: UUID, @RequestBody request: EditPlayNote) = service.edit(campaign, session, note, request).response()
}
