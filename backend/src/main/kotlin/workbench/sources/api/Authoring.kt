package workbench.sources.api

import java.util.UUID
import io.swagger.v3.oas.annotations.media.Schema

/** In-memory interpretation; never scans or publishes a source capture. */
interface Authoring {
    fun inspect(input: AuthoredDocument): AuthoredPreview
    fun catalog(): AuthoringCatalog
    fun decode(raw: String): DecodedAuthoring
    fun encode(input: AuthoredDocument, retainedEnvelope: String = ""): EncodedAuthoring
    fun resolvedLinks(path: String, markdown: String, targets: List<AuthoredLinkTarget>, own: UUID): List<CheckedLink>
    fun links(path: String, body: String, sources: Map<String, String>, drafts: List<AuthoredTarget>, own: UUID): List<CheckedLink>
}
data class AuthoredDocument(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val card: UUID, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val type: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val status: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val tags: List<String>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val summary: String?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val body: String)
data class AuthoringCatalog(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val types: List<String>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val statuses: List<String>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val templates: Map<String, String>)
data class AuthoringLink(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val key: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val anchor: String?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val external: String?, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val unavailable: Boolean)
data class AuthoredPreview(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val classification: SourceClassification, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val sections: List<SourceSection>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val anchors: Map<String, String>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val links: List<AuthoringLink>)
