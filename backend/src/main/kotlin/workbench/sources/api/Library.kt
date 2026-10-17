package workbench.sources.api

import java.util.UUID
import io.swagger.v3.oas.annotations.media.Schema

data class DocumentSummary(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String
)

data class Library(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val capture: UUID?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val needsRefresh: Boolean,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val documents: List<DocumentSummary>
)

data class SourceBlock(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val html: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val text: String
)

data class SourceSection(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val id: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val heading: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val blocks: List<SourceBlock>
)

data class SourceLink(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val key: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val document: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val section: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) val external: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val missing: Boolean
)

data class SourceDocument(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val capture: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val sections: List<SourceSection>,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val links: List<SourceLink>
)

data class SearchHit(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val path: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val section: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val heading: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val block: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val excerpt: String
)

data class SearchResults(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val campaign: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val capture: UUID,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val hits: List<SearchHit>
)
