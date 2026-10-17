package workbench.sources.application

import arrow.core.Either
import workbench.platform.api.Failure
import workbench.sources.domain.*
import workbench.sources.api.SourceSection
import java.util.UUID

interface CaptureStore { fun get(campaign: UUID): Capture?; fun publish(capture: Capture) }
interface SourceScanner { fun scan(scope: SourceScope): Either<Failure, Map<String, String>> }
data class ParsedLink(val key: String, val destination: String)
data class SectionRange(val start: Int, val end: Int)
data class ParsedDocument(val sections: List<SourceSection>, val anchors: Map<String, String>, val links: List<ParsedLink>, val ranges: Map<String, SectionRange> = emptyMap())
interface Markdown { fun parse(text: String): ParsedDocument }
