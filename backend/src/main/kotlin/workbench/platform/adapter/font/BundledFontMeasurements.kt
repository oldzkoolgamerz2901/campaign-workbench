package workbench.platform.adapter.font

import workbench.platform.api.*
import java.awt.Font
import java.awt.font.FontRenderContext
import java.awt.font.TextLayout
import java.security.MessageDigest

/** No system font registration or logical-font fallback; safe in a headless JVM. */
class BundledFontMeasurements(
    private val resource: (String) -> ByteArray? = { name -> BundledFontMeasurements::class.java.getResourceAsStream("/fonts/$name")?.use { it.readBytes() } }
) : FontMeasurements {
    private data class Loaded(val font: Font, val hash: String)
    private val context = FontRenderContext(null, true, true)
    private val loaded = CardFont.entries.associateWith { kind -> runCatching {
        val file = if (kind == CardFont.TITLE) "PTSerif-Regular.ttf" else "PTSans-Regular.ttf"
        val bytes = resource(file) ?: throw FontMeasurementFailure("font-unavailable")
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val expected = if (kind == CardFont.TITLE) "a4951fade06ff8f09b7673aa81ffb65a8cd409e24d3289a6dc670bc4dda2557a" else "9cc831490532009bae2b3ce0d39c62adfc889060beb421593bfd9d2396d0f10a"
        if (hash != expected) throw FontMeasurementFailure("font-unavailable")
        Loaded(Font.createFont(Font.TRUETYPE_FONT, bytes.inputStream()), hash)
    } }
    private fun get(font: CardFont) = loaded.getValue(font).getOrElse { throw FontMeasurementFailure("font-unavailable") }
    override fun identity(font: CardFont) = get(font).hash
    override fun extent(text: String, font: CardFont, size: Double): TextExtent {
        require(size.isFinite() && size > 0 && size <= 100)
        val actual = get(font).font.deriveFont(size.toFloat())
        if (text.codePoints().anyMatch { Character.isISOControl(it) || !actual.canDisplay(it) }) throw FontMeasurementFailure("unsupported-character")
        if (text.isEmpty()) return TextExtent(0.0, 0.0, 0.0, 0.0, 0.0)
        val layout = TextLayout(text, actual, context)
        val ink = layout.bounds
        return TextExtent(layout.advance.toDouble(), minOf(0.0, ink.minX), maxOf(layout.advance.toDouble(), ink.maxX),
            maxOf(layout.ascent.toDouble(), -ink.minY), maxOf(layout.descent.toDouble(), ink.maxY))
    }
}
