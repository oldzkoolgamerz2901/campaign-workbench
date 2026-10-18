package workbench.preparation.api

import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID

data class CapturedCardData(
    val schema: Int, val id: UUID, val title: String, val type: String, val purpose: String, val status: String,
    val tags: List<String>, @field:Schema(nullable = true) val summary: String?
)
data class CapturedIssueData(val code: String, @field:Schema(nullable = true) val field: String?, val message: String, val severity: String)
data class CapturedClassificationData(@field:Schema(nullable = true) val metadata: CapturedCardData?, val issues: List<CapturedIssueData>)
data class CapturedLinkData(
    @field:Schema(nullable = true) val document: String?, @field:Schema(nullable = true) val section: String?,
    @field:Schema(nullable = true) val external: String?, val missing: Boolean
)
data class CapturedRelationshipData(
    val key: String, val originSection: String, val destination: String, val target: CapturedLinkData,
    @field:Schema(nullable = true) val classification: CapturedClassificationData?, val sceneCandidate: Boolean
)
data class CapturedSourceData(val interpretation: Int, val bodyStart: Int, val classification: CapturedClassificationData, val relationships: List<CapturedRelationshipData>)
