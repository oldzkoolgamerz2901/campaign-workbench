package workbench.preparation.domain

import java.util.UUID

// Preparation owns these frozen values independently of the current Sources interpretation.
data class CapturedCard(val schema: Int, val id: UUID, val title: String, val type: String, val purpose: String, val status: String, val tags: List<String>, val summary: String?, val backText: String = "")
data class CapturedIssue(val code: String, val field: String?, val message: String, val severity: String)
data class CapturedClassification(val metadata: CapturedCard?, val issues: List<CapturedIssue>)
data class CapturedLink(val document: String?, val section: String?, val external: String?, val missing: Boolean)
data class CapturedRelationship(val key: String, val originSection: String, val destination: String, val target: CapturedLink, val classification: CapturedClassification?, val sceneCandidate: Boolean)
data class CapturedSource(val interpretation: Int, val bodyStart: Int, val classification: CapturedClassification, val relationships: List<CapturedRelationship>)
