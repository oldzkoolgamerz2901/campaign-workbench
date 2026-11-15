package workbench.sharing.adapter.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.web.bind.annotation.*
import workbench.platform.api.*
import workbench.sharing.api.*
import workbench.sharing.application.OrganizationService
import java.util.UUID

@RestController
@RequestMapping("/api/campaigns/{campaign}/sharing")
class OrganizationController(private val service: OrganizationService) {
    @Operation(operationId="organizeGroupCollection")
    @ApiResponse(responseCode="200",content=[Content(mediaType="application/json",schema=Schema(implementation=SharedCollection::class))])
    @PostMapping("/organization",consumes=["application/json"],produces=["application/json"])
    fun organize(@PathVariable campaign: UUID,@RequestBody request: OrganizeCollection)=service.organizeGroup(campaign,request).response(noStore=true)
}
