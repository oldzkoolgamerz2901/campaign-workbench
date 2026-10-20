package workbench.writing.application

import workbench.writing.domain.Draft
import workbench.writing.domain.ExportArtifact
import workbench.writing.domain.ExportEntry
import java.util.UUID

interface DraftStore {
    fun list(campaign: UUID): List<Draft>
    fun get(campaign: UUID, id: UUID): Draft?
    fun put(draft: Draft)
    fun delete(campaign: UUID, id: UUID)
}
interface ExportStore {
    fun list(campaign: UUID, draft: UUID): List<ExportEntry>
    fun get(campaign: UUID, draft: UUID, id: UUID): ExportArtifact?
    fun put(artifact: ExportArtifact)
}
