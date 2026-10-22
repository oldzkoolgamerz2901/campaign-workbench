package workbench.preparation.application

import workbench.preparation.api.*
import workbench.platform.api.*
import java.util.UUID

class PreparationTransferFacade(private val service: PreparationService, private val images: PreparationImageStore) : PreparationTransfers {
    override fun snapshot(campaign: UUID, session: UUID) = service.open(campaign, session)
    override fun exportContents(campaign: UUID, request: ExportSessions, illustrated: Boolean) = service.export(campaign, request, illustrated)
    override fun validateContents(archive: Archive, illustrated: Boolean) = service.validateArchive(archive, illustrated)
    override fun importContents(campaign: UUID, archive: Archive, illustrated: Boolean) = service.import(campaign, archive, illustrated)
    override fun imageMetadata(campaign: UUID, hash: String) = images.metadata(campaign, hash)
    override fun imageOriginal(campaign: UUID, hash: String) = images.original(campaign, hash)
    override fun putImage(campaign: UUID, image: ProcessedImage) = images.put(campaign, image)
}
