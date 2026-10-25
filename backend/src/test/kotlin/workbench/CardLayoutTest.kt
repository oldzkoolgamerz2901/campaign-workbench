package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.ObjectMapper
import workbench.platform.adapter.font.BundledFontMeasurements
import workbench.platform.api.CardFont
import workbench.sources.application.CardLayouts
import workbench.sources.api.CardLayoutInput
import java.nio.file.Files
import java.nio.file.Path

class CardLayoutTest : StringSpec({
    val measurements = BundledFontMeasurements()
    val engine = CardLayouts(measurements)
    "back accepts exactly 26 lines and rejects the next line without a partial layout" {
        engine.layout(CardLayoutInput(backText = List(26) { "A short line" }.joinToString("\n"))).back.fits shouldBe true
        val overflow = engine.layout(CardLayoutInput(backText = List(27) { "A short line" }.joinToString("\n"))).back
        overflow.fits shouldBe false
        overflow.lines.isEmpty() shouldBe true
        overflow.issues.single().field shouldBe "backText"
    }
    "front title summary and tags compete for a bounded panel" {
        val base = CardLayoutInput("Harbour keeper", "npc", "Remembers every visitor.", listOf("harbour", "watchful"))
        engine.layout(base).front.fits shouldBe true
        engine.layout(base.copy(title = "A long title ".repeat(25))).front.fits shouldBe false
        engine.layout(base.copy(summary = "A long summary ".repeat(40))).front.fits shouldBe false
        engine.layout(base.copy(tags = List(32) { "long-tag-$it" })).front.fits shouldBe false
        // For explicit summary lines, derive the last fitting boundary and check the next line.
        val last = (1..20).last { engine.layout(base.copy(summary = List(it) { "Line" }.joinToString("\n"), tags = emptyList())).front.fits }
        engine.layout(base.copy(summary = List(last + 1) { "Line" }.joinToString("\n"), tags = emptyList())).front.fits shouldBe false
    }
    "line breaks spaces graphemes and unbroken text retain all authored characters" {
        for (text in listOf("first\n\nlast\n", "  spaces  remain  ", "e\u0301 ".repeat(50), "W".repeat(240), "Mira — café; Привет")) {
            val back = engine.layout(CardLayoutInput(backText = text)).back
            back.fits shouldBe true
            back.lines.joinToString("") { it.text } shouldBe text.replace("\n", "")
        }
        engine.layout(CardLayoutInput(backText = "a\r\nb")).back.lines.map { it.text } shouldBe listOf("a", "b")
        val combining = engine.layout(CardLayoutInput(backText = "e\u0301".repeat(100))).back
        combining.lines.none { it.text.startsWith('\u0301') } shouldBe true
    }
    "unsupported characters and font failures are explicit and bounded" {
        engine.layout(CardLayoutInput(backText = "unsupported 🐉")).back.issues.single().code shouldBe "unsupported-character"
        engine.layout(CardLayoutInput(backText = "a\tb")).back.issues.single().code shouldBe "unsupported-character"
        CardLayouts(BundledFontMeasurements { null }).layout(CardLayoutInput()).front.issues.single().code shouldBe "font-unavailable"
        CardLayouts(BundledFontMeasurements { byteArrayOf(1, 2, 3) }).layout(CardLayoutInput()).back.issues.single().code shouldBe "font-unavailable"
        engine.layout(CardLayoutInput(backText = "x".repeat(CardLayouts.TEXT_LIMIT + 1))).back.issues.single().code shouldBe "input-limit"
        engine.layout(CardLayoutInput(tags = List(129) { "a" })).front.issues.single().code shouldBe "input-limit"
        engine.layout(CardLayoutInput(backText = "W".repeat(CardLayouts.TEXT_LIMIT))).back.fits shouldBe false
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
        val frontCapacity = (1..20).last { engine.layout(short.copy(summary = List(it) { "Summary line" }.joinToString("\n"))).front.fits }
        val cases = linkedMapOf(
            "short" to short,
            "front-capacity" to short.copy(summary = List(frontCapacity) { "Summary line" }.joinToString("\n")),
            "front-overflow" to short.copy(summary = List(frontCapacity + 1) { "Summary line" }.joinToString("\n")),
            "tag-rows" to short.copy(tags = List(12) { "tag-$it" }),
            "capacity" to short.copy(backText = List(26) { "Line ${it + 1}: café — Привет" }.joinToString("\n")),
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
