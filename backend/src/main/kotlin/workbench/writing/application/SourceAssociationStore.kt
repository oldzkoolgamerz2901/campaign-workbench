package workbench.writing.application

import workbench.writing.api.SourceAssociationData
import java.util.UUID

interface SourceAssociationStore {
    fun list(campaign: UUID): List<SourceAssociationData>
    fun put(campaign: UUID, association: SourceAssociationData)
}
