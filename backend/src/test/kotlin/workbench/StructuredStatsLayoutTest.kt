package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import workbench.platform.adapter.font.BundledFontMeasurements
import workbench.sources.api.*
import workbench.sources.application.CardLayouts

class StructuredStatsLayoutTest : StringSpec({
    val engine = CardLayouts(BundledFontMeasurements())
    val stats = LayoutStats(ac = "17", hp = "59 (8d8)", initiative = "+4 (14)", speed = "30 ft.", cr = "1/8 (PB +2)",
        abilities = mapOf("STR" to LayoutAbility("8", "-1", "+2")),
        sections = listOf(LayoutStatSection("Actions", listOf(LayoutStatEntry("Strike", "One complete action.")))))
    "CD5 an empty optional stats value does not consume ordinary back capacity" {
        val input = CardLayoutInput(backText = List(23) { "A short line" }.joinToString("\n"))
        engine.layout(input.copy(stats = LayoutStats())) shouldBe engine.layout(input)
    }
    "CFP-R3.4 CD5 core stats precede back text and whole authored groups with fixed geometry" {
        val layout = engine.layout(CardLayoutInput(title = "Keeper", type = "npc", backText = "Information", stats = stats))
        layout.front.fits shouldBe true
        layout.back.fits shouldBe true
        layout.back.overflow shouldBe false
        layout.back.lines.filter { it.field == "stats.ability" }.size shouldBe 24
        layout.back.lines.filter { it.field == "stats.entry" }.joinToString("") { it.text } shouldBe "Strike. One complete action."
        layout.back.lines.all { it.x >= 0 && it.x + it.width <= 229.001 && it.baseline + it.descent <= 378 } shouldBe true
        layout.back.lines.first { it.field.startsWith("stats.") }.baseline.let { y -> y < layout.back.lines.first { it.field == "backText" }.baseline } shouldBe true
    }
    "CD5 long sections and core groups never render partial content and front fit remains independent" {
        val input = CardLayoutInput(title = "Keeper", backText = "Information", stats = stats)
        val huge = stats.copy(sections = listOf(LayoutStatSection("Actions", listOf(LayoutStatEntry("Strike", "Long action ".repeat(300))))))
        val layout = engine.layout(input.copy(stats = huge))
        layout.front shouldBe engine.layout(input).front
        layout.back.fits shouldBe true
        layout.back.overflow shouldBe true
        layout.back.lines.none { it.field == "stats.entry" || it.text == "Actions" } shouldBe true
        layout.back.lines.last().text shouldBe "…"
        val oversized = engine.layout(input.copy(stats = stats.copy(subtitle = "Long subtitle ".repeat(100))))
        oversized.back.fits shouldBe true
        oversized.back.overflow shouldBe true
        oversized.back.lines.none { it.field.startsWith("stats.") } shouldBe true
        oversized.back.lines.any { it.text == "Information" } shouldBe true
        val textOverflow = engine.layout(input.copy(backText = "Line\n".repeat(50)))
        textOverflow.back.lines.filter { it.field == "stats.ability" }.size shouldBe 24
        textOverflow.back.lines.none { it.field == "stats.entry" } shouldBe true
        textOverflow.back.lines.last().text shouldBe "…"
    }
})
