package workbench.sources.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.sources.api.CardLayout
import workbench.sources.api.CardLayoutCalculator
import workbench.sources.api.CardLayoutInput

/** Pure presentation calculation: never resolves or persists campaign content. */
@RestController
@RequestMapping("/api/card-layout", produces = ["application/json"])
class CardLayoutController(private val layouts: CardLayoutCalculator) {
    @Operation(operationId = "calculateCardLayout")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = CardLayout::class))])
    @PostMapping
    fun calculate(@RequestBody input: CardLayoutInput) = layouts.layout(input)
}
