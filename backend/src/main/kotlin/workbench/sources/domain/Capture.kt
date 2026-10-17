package workbench.sources.domain

import java.util.UUID

data class Capture(val campaign: UUID, val id: UUID, val revision: Long, val documents: Map<String, String>)
data class SourceScope(val campaign: UUID, val directory: String, val includes: List<String>, val excludes: List<String>, val revision: Long)
