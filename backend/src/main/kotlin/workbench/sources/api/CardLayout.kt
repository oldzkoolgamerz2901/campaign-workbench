package workbench.sources.api

import io.swagger.v3.oas.annotations.media.Schema

data class CardLayoutInput(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val title: String = "", @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val type: String = "", @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val summary: String = "", @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val tags: List<String> = emptyList(), @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val backText: String = "")
data class CardTextLine(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val field: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val text: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val font: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val size: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val x: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val baseline: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val width: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val ascent: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val descent: Double)
data class CardLayoutBox(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val role: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val x: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val y: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val width: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val height: Double)
data class CardFitIssue(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val field: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val code: String)
/** A non-fitting side exposes no partial text layout. Original text remains with the caller. */
data class CardSideLayout(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fits: Boolean, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val lines: List<CardTextLine>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val boxes: List<CardLayoutBox>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val issues: List<CardFitIssue>)
data class CardLayout(@field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val profile: String, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val width: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val height: Double, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val fonts: Map<String, String>, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val front: CardSideLayout, @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED) val back: CardSideLayout)

interface CardLayoutCalculator { fun layout(input: CardLayoutInput): CardLayout }

/** Fit exactly the normalized metadata frozen by Preparation. */
fun CardMetadata.layoutInput() = CardLayoutInput(title, type, summary.orEmpty(), tags, backText)
