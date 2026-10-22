package workbench.writing.domain

import java.util.UUID
import workbench.platform.api.ImageMetadata

data class Draft(val id: UUID, val campaign: UUID, val card: UUID, val revision: Long, val title: String, val type: String, val status: String, val tags: List<String>, val summary: String, val body: String, val path: String, val origin: DraftOrigin? = null, val recovery: RecoveryOrigin? = null, val image: ImageMetadata? = null)
data class DraftOrigin(val campaign: UUID, val capture: UUID, val path: String, val card: UUID?, val raw: String, val hash: String, val retainedEnvelope: String, val issues: List<String>, val interpretation: Int = 1)

data class RecoveryOrigin(val workspace: UUID, val campaign: UUID, val draft: UUID, val card: UUID, val revision: Long)
