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
    @GetMapping("/scene-overview")
    @Operation(operationId = "playSceneOverview")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = SceneOverview::class))])
    fun overview(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestParam scene: UUID) = service.overview(campaign, session, scene).response()
    @PostMapping("/move")
    @Operation(operationId = "movePlayCard")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = WorkspaceData::class))])
    fun move(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestBody request: MoveCard) = service.move(campaign, session, request).response()
    @PostMapping("/reorder")
    @Operation(operationId = "reorderPlayCards")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = WorkspaceData::class))])
    fun reorder(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestBody request: ReorderCards) = service.reorder(campaign, session, request).response()
    @PostMapping("/cover")
    @Operation(operationId = "choosePlayCover")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = WorkspaceData::class))])
    fun cover(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestBody request: ChooseCover) = service.cover(campaign, session, request).response()
    @PostMapping("/rename-pile")
    @Operation(operationId = "renamePlayPile")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = WorkspaceData::class))])
    fun rename(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestBody request: RenamePile) = service.rename(campaign, session, request).response()
    @PostMapping("/scene")
    @Operation(operationId = "transitionPlayScene")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = WorkspaceData::class))])
    fun transition(@PathVariable campaign: UUID, @PathVariable session: UUID, @RequestBody request: TransitionScene) = service.transition(campaign, session, request).response()
}
