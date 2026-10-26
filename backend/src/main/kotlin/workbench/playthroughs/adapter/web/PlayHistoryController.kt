package workbench.playthroughs.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.*
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.playthroughs.api.*
import java.time.Instant
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/play-history", produces = ["application/json"])
@ApiResponse(responseCode = "400", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(mediaType = "application/problem+json", schema = Schema(implementation = ProblemResponse::class))])
class PlayHistoryController(private val notes: PlayNotes) {
    @GetMapping("/resource")
    @Operation(operationId = "resourcePlayHistory")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PlayHistoryPage::class))])
    fun resource(@PathVariable campaign: UUID, @RequestParam origin: UUID, @RequestParam card: UUID,
        @RequestParam(defaultValue = "false") pinnedOnly: Boolean, @RequestParam(defaultValue = "20") limit: Int,
        @RequestParam(required = false) beforeTime: Instant?, @RequestParam(required = false) beforeId: UUID?) =
        notes.history(campaign, ResourceReference(origin, card), false, pinnedOnly, limit, beforeTime, beforeId).response()

    @GetMapping("/scene")
    @Operation(operationId = "scenePlayHistory")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = PlayHistoryPage::class))])
    fun scene(@PathVariable campaign: UUID, @RequestParam origin: UUID, @RequestParam card: UUID,
        @RequestParam(defaultValue = "false") pinnedOnly: Boolean, @RequestParam(defaultValue = "20") limit: Int,
        @RequestParam(required = false) beforeTime: Instant?, @RequestParam(required = false) beforeId: UUID?) =
        notes.history(campaign, ResourceReference(origin, card), true, pinnedOnly, limit, beforeTime, beforeId).response()
}
