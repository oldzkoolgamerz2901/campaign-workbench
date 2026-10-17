package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import workbench.campaigns.api.*
import workbench.campaigns.domain.PathRules
import workbench.platform.api.*
import workbench.sources.adapter.filesystem.LocalSourceScanner
import workbench.sources.adapter.markdown.CommonmarkMarkdown
import workbench.sources.application.*
import workbench.sources.domain.*
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private class MemoryTransactions : Transactions {
    override fun <T> run(block: () -> Either<Failure, T>) = block()
}
private class MemoryCaptures : CaptureStore {
    var value: Capture? = null
    override fun get(campaign: UUID) = value?.takeIf { it.campaign == campaign }
    override fun publish(capture: Capture) { value = capture }
}
class LibraryBehaviorTest : StringSpec({
    "discovery filters root and nested Markdown, ignores symlinks and never modifies sources" {
        val root = Files.createTempDirectory("library-discovery")
        fun file(path: String, text: String = "# Source") { val p = root.resolve(path); Files.createDirectories(p.parent); Files.writeString(p, text) }
        try {
            listOf("root.MD", "lore/chapter.md", ".hidden.md", ".agents/instructions.md", "AGENTS.md", "lore/CLAUDE.md", "node_modules/no.md", "lore/dist/no.md", "excluded/no.md").forEach { file(it) }
            Files.createSymbolicLink(root.resolve("alias.md"), root.resolve("root.MD"))
            Files.createSymbolicLink(root.resolve("shortcut"), root.resolve("lore"))
            val scope = SourceScope(UUID.randomUUID(), root.toString(), PathRules.defaultIncludes, PathRules.defaultExcludes + "excluded/**", 0)
            val scan = LocalSourceScanner().scan(scope).getOrNull()!!
            scan.keys shouldBe setOf("root.MD", "lore/chapter.md")
            Files.readString(root.resolve("root.MD")) shouldBe "# Source"
            LocalSourceScanner().scan(scope.copy(includes = listOf("lore/*.md"))).getOrNull()!!.keys shouldBe setOf("lore/chapter.md")
            listOf("../secret", "/root", "a/**x", "a/[b]", "a\\b", "").forEach { PathRules.valid(it) shouldBe false }
        } finally { root.toFile().deleteRecursively() }
    }
    "invalid UTF-8 reports the failed document and prevents publication" {
        val root = Files.createTempDirectory("library-invalid-text")
        try {
            Files.write(root.resolve("broken.md"), byteArrayOf(0xc3.toByte(), 0x28))
            val scope = SourceScope(UUID.randomUUID(), root.toString(), PathRules.defaultIncludes, PathRules.defaultExcludes, 0)
            LocalSourceScanner().scan(scope).leftOrNull()!!.message shouldContain "broken.md"
        } finally { root.toFile().deleteRecursively() }
    }
    "parsed passages distinguish repeated headings and suppress executable markup and remote images" {
        val parsed = CommonmarkMarkdown().parse("# Repeat\nFirst passage\n\n# Repeat\nSecond passage\n\n# Repeat-1\nThird passage\n\n| A | B |\n| - | - |\n| x | y |\n\n![remote](https://example.invalid/image)\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))")
        parsed.sections.map { it.id }.distinct().size shouldBe 3
        parsed.anchors.size shouldBe 3
        parsed.sections[1].blocks.any { it.text.contains("Second passage") } shouldBe true
        val html = parsed.sections.flatMap { it.blocks }.joinToString("") { it.html }
        html shouldContain "<table>"
        html.contains("<script>") shouldBe false
        html.contains("<img") shouldBe false
        html.contains("javascript:") shouldBe false
    }
    "search and links retain captured content until refresh, then reject obsolete references" {
        val id = UUID.randomUUID()
        var content = mapOf("read me.md" to "# Repeat\nOld needle\n\n# Repeat\nSecond needle\n\n[next](nested/next%20page.md#destination) [missing](absent.md)", "nested/next page.md" to "# Destination\nTarget")
        val campaign = Campaign(id, "Example", "/example", listOf("**/*.md"), emptyList(), 0)
        val campaigns = object : Campaigns { override fun configuration(id: UUID) = Either.Right(campaign) }
        val scanner = object : SourceScanner { override fun scan(scope: SourceScope) = Either.Right(content) }
        val store = MemoryCaptures()
        val service = SourceService(campaigns, store, scanner, CommonmarkMarkdown(), MemoryTransactions())
        val capture = service.refresh(id).getOrNull()!!.capture!!
        content = mapOf("read me.md" to "# Changed\nNew content")
        val hits = service.search(id, capture, "NEEDLE").getOrNull()!!.hits
        hits.size shouldBe 2
        hits.map { it.section }.distinct().size shouldBe 2
        val document = service.document(id, capture, "read me.md").getOrNull()!!
        document.links.first().document shouldBe "nested/next page.md"
        document.links.first().missing shouldBe false
        document.links.last().missing shouldBe true
        service.document(UUID.randomUUID(), capture, "read me.md").isLeft() shouldBe true
        service.refresh(id).isRight() shouldBe true
        service.search(id, capture, "needle").leftOrNull()!!.code shouldBe "sources.capture-replaced"
    }
    "failed scans preserve captures, overlapping refreshes fail, and changed configuration rejects publication" {
        val id = UUID.randomUUID()
        var campaign = Campaign(id, "Example", "/example", listOf("**/*.md"), emptyList(), 0)
        val campaigns = object : Campaigns { override fun configuration(id: UUID) = Either.Right(campaign) }
        val store = MemoryCaptures()
        val original = Capture(id, UUID.randomUUID(), 0, mapOf("old.md" to "Old")); store.value = original
        val entered = CountDownLatch(1); val release = CountDownLatch(1)
        val scanner = object : SourceScanner {
            override fun scan(scope: SourceScope): Either<Failure, Map<String,String>> {
                entered.countDown(); check(release.await(5, TimeUnit.SECONDS))
                return Either.Right(mapOf("new.md" to "New"))
            }
        }
        val service = SourceService(campaigns, store, scanner, CommonmarkMarkdown(), MemoryTransactions())
        val executor = Executors.newSingleThreadExecutor()
        try {
            val first = executor.submit<Either<Failure, workbench.sources.api.Library>> { service.refresh(id) }
            check(entered.await(5, TimeUnit.SECONDS))
            service.refresh(id).leftOrNull()!!.code shouldBe "sources.refresh-in-progress"
            campaign = campaign.copy(revision = 1)
            release.countDown()
            first.get(5, TimeUnit.SECONDS).leftOrNull()!!.code shouldBe "sources.configuration-changed"
            store.value shouldBe original
            val failed = SourceService(campaigns, store, object : SourceScanner { override fun scan(scope: SourceScope) = Either.Left(Failure.Invalid("sources.refresh-failed", "Unreadable")) }, CommonmarkMarkdown(), MemoryTransactions())
            failed.refresh(id).isLeft() shouldBe true
            store.value shouldBe original
        } finally { release.countDown(); executor.shutdownNow() }
    }
})
