package workbench.preparation.api

import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID
import workbench.platform.api.ImageMetadata
import com.fasterxml.jackson.annotation.JsonInclude

data class ProvenanceData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val capture: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val section: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val documentHash: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val contentHash: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val kind: String = "source",
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val authored: AuthoredOriginData? = null
)

data class PreparedItemData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val markdown: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val provenance: ProvenanceData,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val anchors: Map<String, String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val notes: String,
    @field:Schema(requiredMode = Schema.RequiredMode.NOT_REQUIRED, nullable = true) val capturedSource: CapturedSourceData? = null,
    @get:JsonInclude(JsonInclude.Include.NON_NULL) val image: ImageMetadata? = null
)

data class SessionData(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val objective: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val notes: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val items: List<PreparedItemData>
)

data class SessionSummary(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val objective: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long
)

data class SessionList(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val sessions: List<SessionSummary>
)

data class CreateSession(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val objective: String
)

data class ItemNotes(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val notes: String
)

data class SaveSession(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val objective: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val notes: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val items: List<ItemNotes>
)

data class AddSource(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val revision: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val capture: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val section: String?
)

data class Archive(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val version: Int,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val sessions: List<SessionData>
)

data class ExportSessions(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val sessions: List<UUID>
)

data class MarkdownInput(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val markdown: String
)

data class RenderedLink(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val key: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val target: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val external: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val unavailable: Boolean
)

data class RenderedMarkdown(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val anchors: List<String>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val html: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val links: List<RenderedLink>
)

data class RenderedItem(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val source: RenderedMarkdown,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val notes: RenderedMarkdown
)

data class SessionView(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val notes: RenderedMarkdown,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val items: List<RenderedItem>
)
