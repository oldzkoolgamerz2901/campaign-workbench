package workbench.sources.application

import workbench.platform.api.*
import workbench.sources.api.*
import java.util.regex.Pattern

/** Pure card composition policy. No capture, database, HTTP or approval side effects. */
class CardLayouts(private val fonts: FontMeasurements) : CardLayoutCalculator {
    companion object {
        const val PROFILE = "physical-card-4"
        const val WIDTH = 243.0
        const val HEIGHT = 420.0
        const val TEXT_LIMIT = 16_384
        private val graphemes = Pattern.compile("\\X")
    }
    private class BackOverflow : RuntimeException()
    private class NonFit(val field: String, val reason: String) : RuntimeException()
    private fun extent(text: String, font: CardFont, size: Double, field: String): TextExtent = try {
        fonts.extent(text, font, size)
    } catch (e: FontMeasurementFailure) { throw NonFit(field, e.code) }

    override fun layout(input: CardLayoutInput): CardLayout {
        val identities = try { CardFont.entries.associate { it.name to fonts.identity(it) } } catch (_: FontMeasurementFailure) { emptyMap() }
        fun side(back: Boolean): CardSideLayout {
            val lines = mutableListOf<CardTextLine>()
            val boxes = mutableListOf<CardLayoutBox>()
            var overflow = false
            return try {
                val length = if (back) input.title.length.toLong() + input.type.length + input.backText.length else input.title.length.toLong() + input.quote.length
                if (length > TEXT_LIMIT) throw NonFit("card", "input-limit")
                if (identities.size != 2) throw NonFit("card", "font-unavailable")
                // Empty fields still use the same bounded line slots; CRLF is a single authored break.
                fun block(field: String, text: String, font: CardFont, size: Double, x: Double, top: Double, width: Double, bottom: Double, truncate: Boolean = false): Double {
                    val step = size * 1.4
                    var y = top
                    fun line(value: String) {
                        if (truncate && y + step > bottom + 0.0001) throw BackOverflow()
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
                if (back) {
                    boxes += CardLayoutBox("flip-control", 14.0, 388.0, 36.0, 26.0)
                    boxes += CardLayoutBox("details-control", 139.0, 388.0, 90.0, 26.0)
                    val titleBottom = block("title", input.title.ifEmpty { "Untitled card" }, CardFont.TITLE, 14.0, 14.0, 14.0, 145.0, 210.0)
                    val typeBottom = block("type", input.type.ifEmpty { "Untyped" }, CardFont.BODY, 9.0, 174.0, 14.0, 55.0, 210.0)
                    val backTop = maxOf(52.0, titleBottom + 14.0, typeBottom + 14.0)
                    boxes += CardLayoutBox("back-text", 14.0, backTop, 215.0, 378.0 - backTop)
                    if (input.stats?.valid() == false) throw NonFit("stats", "input-limit")
                    val stats = input.stats?.takeIf { it.hasContent() }
                    if (stats == null) {
                        if (input.backText.isEmpty()) {
                            block("emptyBack", "No back information", CardFont.BODY, 10.0, 14.0, backTop, 215.0, 378.0)
                        } else try {
                            block("backText", input.backText, CardFont.BODY, 10.0, 14.0, backTop, 215.0, 378.0, truncate = true)
                        } catch (_: BackOverflow) {
                            overflow = true
                            val last = lines.removeAt(lines.lastIndex)
                            block("continuation", "…", CardFont.BODY, 10.0, 14.0, last.baseline - last.ascent, 215.0, 378.0)
                        }
                    } else {
                        // Reserve one complete continuation line. Atomic groups roll back their geometry.
                        var y = backTop
                        val bottom = 364.0
                        fun text(field: String, value: String, size: Double = 10.0, x: Double = 14.0, width: Double = 215.0, top: Double = y): Double =
                            block(field, value, CardFont.BODY, size, x, top, width, bottom, truncate = true)
                        fun group(draw: () -> Unit): Boolean {
                            val before = lines.size; val beforeBoxes = boxes.size; val top = y
                            return try { draw(); if (y > bottom) throw BackOverflow(); true } catch (_: BackOverflow) {
                                while (lines.size > before) lines.removeAt(lines.lastIndex)
                                while (boxes.size > beforeBoxes) boxes.removeAt(boxes.lastIndex)
                                y = top; overflow = true; false
                            }
                        }
                        fun heading(value: String) {
                            if (value.isNotBlank()) {
                                y = text("stats.heading", value, 9.0)
                                boxes += CardLayoutBox("stat-rule", 14.0, y, 215.0, 0.5)
                                y += 4.0
                            }
                        }
                        val core = group {
                            if (stats.subtitle.isNotBlank()) y = text("stats.subtitle", stats.subtitle) + 4.0
                            val keys = listOf("AC" to stats.ac, "Initiative" to stats.initiative, "HP" to stats.hp,
                                "CR" to stats.cr, "Speed" to stats.speed)
                            for (row in keys.chunked(2)) {
                                val top = y
                                y = row.mapIndexed { col, (label, value) ->
                                    if (value.isBlank()) top else text("stats.key", "$label: $value", x = 14.0 + col * 110.0, width = 105.0, top = top)
                                }.max()
                            }
                            if (stats.abilities.isNotEmpty()) {
                                y += 4.0
                                val top = y
                                text("stats.abilityHeading", "Score  Mod  Save", 9.0, 38.0, 78.0, top)
                                text("stats.abilityHeading", "Score  Mod  Save", 9.0, 148.0, 78.0, top)
                                y += 12.6
                                for ((index, pair) in listOf("STR" to "DEX", "INT" to "WIS", "CON" to "CHA").withIndex()) {
                                    val rowTop = y
                                    if (index % 2 == 0) boxes += CardLayoutBox("stat-band", 14.0, rowTop, 215.0, 14.0)
                                    y = listOf(pair.first, pair.second).mapIndexed { col, key ->
                                        val a = stats.abilities[key]
                                        val x = 14.0 + col * 110.0
                                        text("stats.ability", key, 9.0, x, 23.0, rowTop)
                                        val values = listOf(a?.score, a?.modifier, a?.save)
                                        values.mapIndexed { i, value -> text("stats.ability", value?.takeIf { it.isNotEmpty() } ?: "—",
                                            9.0, x + 25.0 + i * 27.0, 26.0, rowTop) }.max()
                                    }.max() + 1.4
                                }
                            }
                            y += 5.0
                        }
                        if (input.backText.isNotEmpty()) {
                            val before = lines.size
                            try { y = text("backText", input.backText) + 5.0 } catch (_: BackOverflow) {
                                // Keep complete text lines; all later groups remain in Details.
                                overflow = true; y = bottom
                            }
                            if (before == lines.size) overflow = true
                        }
                        var remaining = core && y < bottom
                        val supporting = listOf("Skills" to stats.skills, "Vulnerabilities" to stats.vulnerabilities,
                            "Resistances" to stats.resistances, "Immunities" to stats.immunities,
                            "Gear" to stats.gear, "Senses" to stats.senses, "Languages" to stats.languages).filter { it.second.isNotBlank() }
                        if (supporting.isNotEmpty()) {
                            if (remaining) remaining = group {
                                heading("Skills & Gear")
                                supporting.forEach { (label, value) -> y = text("stats.supporting", "$label: $value") }
                                y += 5.0
                            } else overflow = true
                        }
                        for (section in stats.sections) {
                            val entries = section.entries.filter { it.name.isNotBlank() || it.text.isNotBlank() || it.spellcasting != null }
                            if (entries.isEmpty()) continue
                            if (remaining) remaining = group {
                                heading(section.title)
                                for (entry in entries) {
                                    val spell = entry.spellcasting
                                    if (spell != null) {
                                        val label = listOf(spell.ability, spell.dc.takeIf { it.isNotBlank() }?.let { "DC $it" }.orEmpty()).filter { it.isNotBlank() }.joinToString(", ")
                                        y = text("stats.entry", "Spellcasting" + if (label.isEmpty()) "" else " ($label)")
                                        if (spell.spells.isNotEmpty()) y = text("stats.entry", spell.spells)
                                    } else y = text("stats.entry", listOf(entry.name.takeIf { it.isNotEmpty() }?.let { "$it." }.orEmpty(), entry.text).filter { it.isNotEmpty() }.joinToString(" "))
                                    y += 4.0
                                }
                            } else overflow = true
                        }
                        if (overflow) block("continuation", "…", CardFont.BODY, 10.0, 14.0, 364.0, 215.0, 378.0)
                        if (lines.none { it.field.startsWith("stats.") || it.field == "backText" } && !overflow)
                            block("emptyBack", "No back information", CardFont.BODY, 10.0, 14.0, backTop, 215.0, 378.0)
                    }
                } else {
                    boxes += CardLayoutBox("flip-control", 199.0, 8.0, 36.0, 26.0)
                    boxes += CardLayoutBox("context-actions", 8.0, 8.0, 36.0, 26.0)
                    boxes += CardLayoutBox("front-panel", 6.0, 246.0, 231.0, 168.0)
                    boxes += CardLayoutBox("document-control", 14.0, 388.0, 215.0, 18.0)
                    val y = block("title", input.title.ifEmpty { "Untitled card" }, CardFont.TITLE, 16.0, 14.0, 254.0, 215.0, 382.0) + 6.0
                    if (input.quote.isNotEmpty()) {
                        val top = y
                        val bottom = block("quote", input.quote, CardFont.TITLE, 10.0, 18.0, y + 3.0, 207.0, 382.0) + 3.0
                        if (bottom > 382.0) throw NonFit("quote", "overflow")
                        boxes += CardLayoutBox("quote-area", 14.0, top, 215.0, bottom - top)
                    }
                }
                CardSideLayout(true, lines, boxes, emptyList(), overflow)
            } catch (e: NonFit) { CardSideLayout(false, emptyList(), emptyList(), listOf(CardFitIssue(e.field, e.reason))) }
        }
        return CardLayout(PROFILE, WIDTH, HEIGHT, identities, side(false), side(true))
    }
}
