package workbench.preparation.application

import java.util.UUID
import workbench.platform.api.*

/** Immutable storage internal to Preparation. Writes join the caller's transaction. */
interface PreparationImageStore {
    fun put(owner: UUID, image: ProcessedImage)
    fun metadata(owner: UUID, hash: String): ImageMetadata?
    fun original(owner: UUID, hash: String): ImageBytes?
    fun derivative(owner: UUID, hash: String, policy: Int, variant: ImageVariant): ImageDerivative?
    fun prune(owner: UUID)
    fun bundle(owner: UUID, hash: String): ProcessedImage? {
        val m = metadata(owner, hash) ?: return null
        val bytes = original(owner, hash) ?: return null
        val variants = ImageVariant.entries.map { derivative(owner, hash, ImageLimits.POLICY, it) ?: return null }
        return ProcessedImage(m, bytes, variants)
    }
}
