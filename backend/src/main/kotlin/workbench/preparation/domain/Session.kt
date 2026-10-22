package workbench.preparation.domain

import java.util.UUID
import workbench.platform.api.ImageMetadata

data class Provenance(val campaign: UUID, val capture: UUID?, val path: String, val section: String?, val documentHash: String, val contentHash: String, val kind: String = "source", val authored: AuthoredOrigin? = null)
data class PreparedItem(val id: UUID, val title: String, val markdown: String, val provenance: Provenance, val anchors: Map<String, String>, val notes: String, val capturedSource: CapturedSource? = null, val image: ImageMetadata? = null)
data class Session(val id: UUID, val campaign: UUID, val revision: Long, val title: String, val objective: String, val notes: String, val items: List<PreparedItem>)
