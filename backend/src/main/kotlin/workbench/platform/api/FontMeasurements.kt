package workbench.platform.api

/** Measurements include both advance and ink bounds; coordinates are font-size units. */
data class TextExtent(val advance: Double, val left: Double, val right: Double, val ascent: Double, val descent: Double) {
    val width get() = right - left
}
enum class CardFont { BODY, TITLE }
class FontMeasurementFailure(val code: String) : RuntimeException(code)
interface FontMeasurements {
    fun identity(font: CardFont): String
    fun extent(text: String, font: CardFont, size: Double): TextExtent
}
