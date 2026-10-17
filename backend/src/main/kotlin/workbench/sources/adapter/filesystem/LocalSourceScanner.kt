package workbench.sources.adapter.filesystem

import arrow.core.Either
import org.springframework.stereotype.Component
import workbench.platform.api.Failure
import workbench.sources.application.SourceScanner
import workbench.sources.domain.SourceScope
import java.nio.file.*
import java.nio.file.attribute.BasicFileAttributes

@Component
class LocalSourceScanner : SourceScanner {
    override fun scan(scope: SourceScope): Either<Failure, Map<String, String>> {
        var reading = "the registered folder"
        return try {
            val root = Path.of(scope.directory)
            require(Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS) && Files.isReadable(root))
            val includes = scope.includes.map(::glob)
            val excludes = scope.excludes.map(::glob)
            val documents = sortedMapOf<String, String>()
            Files.walkFileTree(root, object : SimpleFileVisitor<Path>() {
                override fun visitFile(file: Path, attributes: BasicFileAttributes): FileVisitResult {
                    if (!attributes.isRegularFile || attributes.isSymbolicLink) return FileVisitResult.CONTINUE
                    val relative = root.relativize(file).joinToString("/")
                    if (file.fileName.toString().endsWith(".md", true) && includes.any { it.matches(relative) } && excludes.none { it.matches(relative) }) {
                        reading = relative
                        var parent = file.parent
                        while (parent != root) {
                            require(!Files.isSymbolicLink(parent))
                            parent = parent.parent
                        }
                        require(Files.isReadable(file))
                        val before = Files.readAttributes(file, BasicFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
                        require(before.isRegularFile && !before.isSymbolicLink)
                        // NOFOLLOW_LINKS also rejects a final-path symlink introduced after discovery.
                        val text = Files.newByteChannel(file, setOf(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS)).use { channel ->
                            java.nio.channels.Channels.newReader(channel, Charsets.UTF_8.newDecoder(), -1).readText()
                        }
                        val after = Files.readAttributes(file, BasicFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
                        require(after.isRegularFile && !after.isSymbolicLink && before.fileKey() == after.fileKey() && before.size() == after.size() && before.lastModifiedTime() == after.lastModifiedTime())
                        documents[relative] = text
                    }
                    return FileVisitResult.CONTINUE
                }
                override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
                    if (dir != root) {
                        val prefix = root.relativize(dir).joinToString("/")
                        if (excludes.any { it.matches(prefix) || it.matches("$prefix/") }) return FileVisitResult.SKIP_SUBTREE
                    }
                    return FileVisitResult.CONTINUE
                }
            })
            Either.Right(documents)
        } catch (_: Exception) {
            Either.Left(Failure.Unreadable("sources.refresh-failed", "Could not read $reading reliably. Check folder access and source rules, then refresh. The previous capture is unchanged."))
        }
    }


    private fun glob(pattern: String): Regex {
        val out = StringBuilder("^")
        var i = 0
        while (i < pattern.length) {
            when {
                pattern.startsWith("**/", i) -> { out.append("(?:.*/)?"); i += 3 }
                pattern.startsWith("**", i) -> { out.append(".*"); i += 2 }
                pattern[i] == '*' -> { out.append("[^/]*"); i++ }
                pattern[i] == '?' -> { out.append("[^/]"); i++ }
                else -> { out.append(Regex.escape(pattern[i].toString())); i++ }
            }
        }
        return Regex(out.append('$').toString(), RegexOption.IGNORE_CASE)
    }
}
