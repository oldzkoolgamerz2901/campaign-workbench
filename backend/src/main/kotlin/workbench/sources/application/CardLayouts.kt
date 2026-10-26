package workbench.sources.application

import workbench.platform.api.*
import workbench.sources.api.*
import java.util.regex.Pattern

/** Pure card composition policy. No capture, database, HTTP or approval side effects. */
class CardLayouts(private val fonts: FontMeasurements) : CardLayoutCalculator {
    companion object {
        const val PROFILE = "physical-card-1"
        const val WIDTH = 243.0
        const val HEIGHT = 420.0
        const val TEXT_LIMIT = 16_384
        private val graphemes = Pattern.compile("\\X")
    }
    private class NonFit(val field: String, val reason: String) : RuntimeException()
    private fun extent(text: String, font: CardFont, size: Double, field: String): TextExtent = try {
        fonts.extent(text, font, size)
    } catch (e: FontMeasurementFailure) { throw NonFit(field, e.code) }

    override fun layout(input: CardLayoutInput): CardLayout {
        val identities = try { CardFont.entries.associate { it.name to fonts.identity(it) } } catch (_: FontMeasurementFailure) { emptyMap() }
        val bounded = input.tags.size <= 128 && (listOf(input.title, input.type, input.summary, input.backText).sumOf { it.length.toLong() } + input.tags.sumOf { it.length.toLong() }) <= TEXT_LIMIT
        fun side(back: Boolean): CardSideLayout {
            val lines = mutableListOf<CardTextLine>()
            val boxes = mutableListOf<CardLayoutBox>()
            return try {
                if (!bounded) throw NonFit("card", "input-limit")
                if (identities.size != 2) throw NonFit("card", "font-unavailable")
                // Empty fields still use the same bounded line slots; CRLF is a single authored break.
                fun block(field: String, text: String, font: CardFont, size: Double, x: Double, top: Double, width: Double, bottom: Double): Double {
                    val step = size * 1.4
                    var y = top
                    fun line(value: String) {
                        val m = extent(value, font, size, field)
                        if (m.width > width || m.ascent + m.descent > step || y + step > bottom + 0.0001) throw NonFit(field, "overflow")
                        lines += CardTextLine(field, value, font.name, size, x - m.left, y + m.ascent, m.width, m.ascent, m.descent)
                        y += step
                    }
                    for (paragraph in text.replace("\r\n", "\n").split('\n')) {
                        if (paragraph.isEmpty()) { line(""); continue }
                        var remaining = paragraph
                        while (remaining.isNotEmpty()) {
                            val matcher = graphemes.matcher(remaining)
                            var end = 0
                            var wordEnd = 0
                            while (matcher.find()) {
                                val next = matcher.end()
                                if (extent(remaining.substring(0, next), font, size, field).width > width) break
                                end = next
                                if (remaining.substring(matcher.start(), next).all { it == ' ' }) wordEnd = next
                            }
                            if (end == 0) throw NonFit(field, "overflow")
                            val take = if (end < remaining.length && wordEnd > 0) wordEnd else end
                            line(remaining.substring(0, take))
                            remaining = remaining.substring(take)
                        }
                    }
                    return y
                }
                boxes += CardLayoutBox("flip-control", 199.0, 8.0, 36.0, 26.0)
                if (back) {
                    boxes += CardLayoutBox("back-text", 14.0, 42.0, 215.0, 364.0)
                    if (input.backText.isNotEmpty()) block("backText", input.backText, CardFont.BODY, 10.0, 14.0, 42.0, 215.0, 406.0)
                } else {
                    boxes += CardLayoutBox("context-actions", 8.0, 8.0, 36.0, 26.0)
                    boxes += CardLayoutBox("front-panel", 6.0, 246.0, 231.0, 168.0)
                    boxes += CardLayoutBox("document-control", 14.0, 388.0, 215.0, 18.0)
                    var y = block("title", input.title.ifEmpty { "Untitled card" }, CardFont.TITLE, 16.0, 14.0, 254.0, 215.0, 382.0) + 3.0
                    y = block("type", input.type.ifEmpty { "Untyped" }, CardFont.BODY, 8.0, 14.0, y, 215.0, 382.0) + 4.0
                    y = block("summary", input.summary.ifEmpty { "No summary yet. Add one to describe this card." }, CardFont.BODY, 10.0, 14.0, y, 215.0, 382.0) + 4.0
                    var x = 14.0
                    for (tag in input.tags) {
                        val m = extent(tag, CardFont.BODY, 8.0, "tags")
                        val w = m.width + 10.0
                        if (w > 215.0 || m.ascent + m.descent > 16.0) throw NonFit("tags", "overflow")
                        if (x + w > 229.0) { x = 14.0; y += 19.0 }
                        if (y + 16.0 > 382.0) throw NonFit("tags", "overflow")
                        boxes += CardLayoutBox("tag", x, y, w, 16.0)
                        lines += CardTextLine("tags", tag, "BODY", 8.0, x + 5.0 - m.left, y + 11.0, m.width, m.ascent, m.descent)
                        x += w + 3.0
                    }
                }
                CardSideLayout(true, lines, boxes, emptyList())
            } catch (e: NonFit) { CardSideLayout(false, emptyList(), emptyList(), listOf(CardFitIssue(e.field, e.reason))) }
        }
        return CardLayout(PROFILE, WIDTH, HEIGHT, identities, side(false), side(true))
    }
}
