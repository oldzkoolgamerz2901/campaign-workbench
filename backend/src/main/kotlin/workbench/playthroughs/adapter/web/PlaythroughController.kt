package workbench.playthroughs.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.*
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.playthroughs.api.*
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sessions/{session}/workspace", produces = ["application/json"])
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "409", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class PlaythroughController(private val service: Playthroughs) {
    @GetMapping("/suggestions")
    @Operation(operationId = "playRelationshipSuggestions")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = RelationshipSuggestions::class))])
    fun suggestions(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestParam scene: UUID) = service.suggestions(campaign, session, scene).response()
    @GetMapping
    @Operation(operationId = "openPlayWorkspace")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = WorkspaceData::class))])
    fun open(@PathVariable campaign: UUID, @PathVariable session: UUID) = service.open(campaign, session).response()
    @PutMapping
    @Operation(operationId = "savePlayWorkspace")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = WorkspaceData::class))])
    fun save(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestBody request: SaveWorkspace) = service.save(campaign, session, request).response()
}
