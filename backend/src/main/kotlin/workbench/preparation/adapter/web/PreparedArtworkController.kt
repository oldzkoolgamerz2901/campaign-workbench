package workbench.preparation.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.preparation.application.PreparedArtworkService
import java.util.UUID

@RestController
class PreparedArtworkController(private val artwork: PreparedArtworkService) {
    @GetMapping("/api/campaigns/{campaign}/sessions/{session}/items/{item}/artwork/{variant}", produces = ["image/jpeg", "image/png"])
    @Operation(operationId = "getPreparedArtwork")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(type = "string", format = "binary"))])
    @ApiResponse(responseCode = "404", content = [Content(schema = Schema(implementation = ProblemResponse::class))])
    fun read(@PathVariable campaign: UUID, @PathVariable session: UUID, @PathVariable item: UUID, @PathVariable variant: ImageVariant, @RequestHeader("If-None-Match", required = false) etag: String?) = artwork.read(campaign, session, item, variant).imageResponse(etag)
}
