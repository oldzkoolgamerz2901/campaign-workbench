package workbench.writing.domain

import java.util.UUID

data class FrozenExportLink(val key: String, val destination: String, val kind: String, val path: String?, val anchor: String?, val section: String?, val external: String?, val draft: UUID?, val revision: Long?, val warning: String?)
data class ExportArtifact(
    val id: UUID, val snapshot: Draft, val createdAt: String, val markdown: String, val hash: String,
    val capture: UUID?, val fingerprint: String, val warnings: List<String>, val links: List<FrozenExportLink>,
    val targetRevisions: Map<String, Long>, val acknowledged: Boolean
)
data class ExportEntry(val id: UUID, val revision: Long, val createdAt: String, val path: String, val hash: String, val warnings: List<String>, val fingerprint: String, val acknowledged: Boolean)
