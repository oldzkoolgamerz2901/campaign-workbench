package workbench.sources.api

import io.swagger.v3.oas.annotations.media.Schema
import java.util.Locale
import java.util.UUID

data class CardMetadata(
    val schema: Int,
    val id: UUID,
    val title: String,
    val type: String,
    val purpose: String,
    val status: String,
    val tags: List<String>,
    @field:Schema(nullable = true) val summary: String?
)

data class ClassificationIssue(val code: String, val field: String?, val message: String, val severity: String = "error")

data class SourceClassification(
    @field:Schema(nullable = true) val metadata: CardMetadata? = null,
    val issues: List<ClassificationIssue> = emptyList(),
    val interpretation: Int = 1
)

// Filters are read-only views of a capture; no labels are inferred from paths.
data class SourceFilter(
    val types: Set<String> = emptySet(),
    val tags: Set<String> = emptySet(),
    val purposes: Set<String> = emptySet(),
    val statuses: Set<String> = emptySet(),
    val unclassified: Boolean = false,
    val issues: Boolean = false
) {
    fun matches(classification: SourceClassification): Boolean {
        val metadata = classification.metadata
        return (!unclassified || metadata == null) && (!issues || classification.issues.isNotEmpty()) &&
            (types.isEmpty() || metadata?.type in types) &&
            (purposes.isEmpty() || metadata?.purpose in purposes) &&
            (statuses.isEmpty() || metadata?.status in statuses) &&
            (tags.isEmpty() || metadata?.tags?.containsAll(tags.map { it.trim().lowercase(Locale.ROOT) }) == true)
    }
}

data class SourceRelationship(
    val key: String,
    val originSection: String,
    val destination: String,
    val target: SourceLink,
    @field:Schema(nullable = true) val classification: SourceClassification?,
    val sceneCandidate: Boolean
)
