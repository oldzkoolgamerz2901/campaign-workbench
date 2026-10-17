package workbench.platform.adapter.web

import io.swagger.v3.oas.annotations.Operation
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import workbench.platform.api.StatusResponse

@RestController
class StatusController {
    @Operation(operationId = "getStatus", summary = "Check application connectivity")
    @GetMapping("/api/status", produces = ["application/json"])
    fun status() = StatusResponse("ready")
}
