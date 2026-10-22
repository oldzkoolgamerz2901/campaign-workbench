package workbench.writing.application

import java.util.UUID
import workbench.platform.api.*

sealed interface WritingImageOwner {
    val id: UUID
    data class Campaign(override val id: UUID) : WritingImageOwner
    data class Recovery(override val id: UUID) : WritingImageOwner

}
/** Immutable storage internal to Writing. Writes join the caller's transaction. */
interface WritingImageStore {
    fun put(owner: WritingImageOwner, image: ProcessedImage)
    fun metadata(owner: WritingImageOwner, hash: String): ImageMetadata?
    fun original(owner: WritingImageOwner, hash: String): ImageBytes?
    fun derivative(owner: WritingImageOwner, hash: String, policy: Int, variant: ImageVariant): ImageDerivative?
    fun prune(owner: WritingImageOwner)
    fun bundle(owner: WritingImageOwner, hash: String): ProcessedImage? {
        val m = metadata(owner, hash) ?: return null
        val bytes = original(owner, hash) ?: return null
        val variants = ImageVariant.entries.map { derivative(owner, hash, ImageLimits.POLICY, it) ?: return null }
        return ProcessedImage(m, bytes, variants)
    }
}
