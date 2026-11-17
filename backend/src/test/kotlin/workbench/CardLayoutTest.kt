package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.ObjectMapper
import workbench.platform.adapter.font.BundledFontMeasurements
import workbench.platform.api.CardFont
import workbench.sources.application.CardLayouts
import workbench.sources.api.*
import java.nio.file.Files
import java.nio.file.Path

class CardLayoutTest : StringSpec({
    val measurements = BundledFontMeasurements()
    val engine = CardLayouts(measurements)
    "CD2 back exact capacity stays complete and the next line yields valid compact geometry with explicit continuation" {
        val text = List(23) { "A short line" }.joinToString("\n")
        val exact = engine.layout(CardLayoutInput(backText = text)).back
        exact.fits shouldBe true
        exact.overflow shouldBe false
        exact.lines.filter { it.field == "backText" }.size shouldBe 23
        val overflow = engine.layout(CardLayoutInput(backText = "$text\nOne more line")).back
        overflow.fits shouldBe true
        overflow.overflow shouldBe true
        overflow.issues.isEmpty() shouldBe true
        overflow.lines.filter { it.field == "backText" }.size shouldBe 22
        overflow.lines.last().text shouldBe "…"
        overflow.lines.filter { it.field in setOf("title", "type") }.map { it.text } shouldBe listOf("Untitled card", "Untyped")
    }
    "CFP-R1.1 CD2 fronts contain only title and quote and ignore non-rendered fields and back length" {
        val base = CardLayoutInput("Harbour keeper", "npc", "Remembers every visitor.", listOf("harbour", "watchful"))
        engine.layout(base).front.fits shouldBe true
        engine.layout(base.copy(title = "A long title ".repeat(25))).front.fits shouldBe false
        engine.layout(base.copy(summary = "A long summary ".repeat(4000), tags = List(129) { "long-tag-$it" }, type = "npc".repeat(10000), backText = "x".repeat(65536))).front shouldBe engine.layout(base).front
        val quoted = engine.layout(base.copy(quote = "Every visitor has a story.")).front
        quoted.fits shouldBe true
        quoted.lines.filter { it.field == "quote" }.joinToString("") { it.text } shouldBe "Every visitor has a story."
        quoted.boxes.any { it.role == "quote-area" } shouldBe true
        quoted.lines.all { it.field in setOf("title", "quote") } shouldBe true
        quoted.boxes.none { it.role == "summary-area" } shouldBe true
        engine.layout(base.copy(quote = "Long quote ".repeat(80))).front.issues.single().field shouldBe "quote"
        engine.layout(base.copy(quote = "Unsupported 🐉")).front.issues.single().code shouldBe "unsupported-character"
        val empty = engine.layout(base).front
        empty.boxes.none { it.role == "quote-area" || it.role == "summary-area" } shouldBe true
        val last = (1..20).last { engine.layout(base.copy(quote = List(it) { "Line" }.joinToString("\n"))).front.fits }
        engine.layout(base.copy(quote = List(last + 1) { "Line" }.joinToString("\n"))).front.fits shouldBe false
    }
    "line breaks spaces graphemes and unbroken text retain all authored characters" {
        for (text in listOf("first\n\nlast\n", "  spaces  remain  ", "e\u0301 ".repeat(50), "W".repeat(240), "Mira — café; Привет")) {
            val back = engine.layout(CardLayoutInput(backText = text)).back
            back.fits shouldBe true
            back.lines.filter { it.field == "backText" }.joinToString("") { it.text } shouldBe text.replace("\n", "")
        }
        engine.layout(CardLayoutInput(backText = "a\r\nb")).back.lines.filter { it.field == "backText" }.map { it.text } shouldBe listOf("a", "b")
        val combining = engine.layout(CardLayoutInput(backText = "e\u0301".repeat(100))).back
        combining.lines.none { it.text.startsWith('\u0301') } shouldBe true
    }
    "unsupported characters and font failures are explicit and bounded" {
        engine.layout(CardLayoutInput(backText = "unsupported 🐉")).back.issues.single().code shouldBe "unsupported-character"
        engine.layout(CardLayoutInput(backText = "a\tb")).back.issues.single().code shouldBe "unsupported-character"
        CardLayouts(BundledFontMeasurements { null }).layout(CardLayoutInput()).front.issues.single().code shouldBe "font-unavailable"
        CardLayouts(BundledFontMeasurements { byteArrayOf(1, 2, 3) }).layout(CardLayoutInput()).back.issues.single().code shouldBe "font-unavailable"
        engine.layout(CardLayoutInput(backText = "x".repeat(CardLayouts.TEXT_LIMIT + 1))).back.issues.single().code shouldBe "input-limit"
        engine.layout(CardLayoutInput(quote = "x".repeat(CardLayouts.TEXT_LIMIT + 1))).front.issues.single().code shouldBe "input-limit"
        engine.layout(CardLayoutInput(tags = List(129) { "a" })).front.fits shouldBe true
        engine.layout(CardLayoutInput(backText = "W".repeat(CardLayouts.TEXT_LIMIT))).back.overflow shouldBe true
    }
    "layout is deterministic and all emitted geometry remains within the card" {
        val input = CardLayoutInput("The keeper", "NPC", "Watchful and patient.", listOf("harbour"), "A name.\nA motive.\nA secret.")
        val result = engine.layout(input)
        result shouldBe engine.layout(input)
        result.profile shouldBe CardLayouts.PROFILE
        result.fonts["BODY"] shouldBe "9cc831490532009bae2b3ce0d39c62adfc889060beb421593bfd9d2396d0f10a"
        for (side in listOf(result.front, result.back)) {
            side.fits shouldBe true
            side.lines.all { it.x >= 0 && it.x + it.width <= 243 && it.baseline - it.ascent >= 0 && it.baseline + it.descent <= 420 } shouldBe true
            side.boxes.all { it.x >= 0 && it.y >= 0 && it.x + it.width <= 243 && it.y + it.height <= 420 } shouldBe true
        }
        measurements.extent(" ", CardFont.BODY, 10.0).width.let { it > 0 } shouldBe true
    }
    "emit real backend layouts for the isolated browser renderer fixture" {
        val short = CardLayoutInput("Harbour keeper", "NPC", "Remembers every visitor.", listOf("harbour", "watchful"), "Motivation\nProtect the harbour.\n\nSecret\nKnows who took the ledger.")
        val frontCapacity = (1..20).last { engine.layout(short.copy(quote = List(it) { "Quote line" }.joinToString("\n"))).front.fits }
        val cases = linkedMapOf(
            "short" to short,
            "stats" to short.copy(stats = LayoutStats(ac = "17", hp = "59 (8d8)", initiative = "+4 (14)", abilities = mapOf("STR" to LayoutAbility("8", "-1", "+2")))),
            "stats-overflow" to short.copy(stats = LayoutStats(ac = "17", sections = listOf(LayoutStatSection("Actions", listOf(LayoutStatEntry("Strike", "Long action ".repeat(300))))))),
            "front-capacity" to short.copy(quote = List(frontCapacity) { "Quote line" }.joinToString("\n")),
            "front-overflow" to short.copy(quote = List(frontCapacity + 1) { "Quote line" }.joinToString("\n")),
            "tag-rows" to short.copy(tags = List(12) { "tag-$it" }),
            "quote-summary" to short.copy(quote = "Every visitor has a story."),
            "quote-only" to short.copy(quote = "Every visitor has a story.", summary = ""),
            "no-areas" to short.copy(summary = ""),
            "quote-overflow" to short.copy(quote = "Long quote ".repeat(80)),
            "capacity" to short.copy(backText = List(23) { "Line ${it + 1}: café — Привет" }.joinToString("\n")),
            "wrapping" to short.copy(backText = "Word spacing and e\u0301. ".repeat(40)),
            "unbroken" to short.copy(backText = "W".repeat(240)),
            "markup" to short.copy(title = "<b>Mira</b>", backText = "<script>alert('text')</script>\n  spaces stay  "),
            "empty" to short.copy(backText = ""),
            "overflow" to short.copy(backText = "too much\n".repeat(27)),
            "unsupported" to short.copy(backText = "🐉")
        )
        val fixtures = cases.map { (name, input) -> mapOf("name" to name, "input" to input, "layout" to engine.layout(input)) }
        val directory = Path.of("build/card-layout")
        Files.createDirectories(directory)
        Files.writeString(directory.resolve("layouts.json"), ObjectMapper().writeValueAsString(fixtures))
    }
})

/** Executed with PropertiesLauncher against bootJar, not the Gradle application classpath. */
object CardLayoutPackagedProbe {
    @JvmStatic fun main(args: Array<String>) {
        check(java.awt.GraphicsEnvironment.isHeadless())
        val result = CardLayouts(BundledFontMeasurements()).layout(CardLayoutInput("Packaged fonts", "Reference", "Exact bundled resources.", backText = "Café — Привет\ne\u0301"))
        check(result.front.fits && result.back.fits)
        println("Packaged canonical font layout passed in headless mode: ${result.profile}")
    }
}
