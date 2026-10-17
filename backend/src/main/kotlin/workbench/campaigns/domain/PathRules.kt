package workbench.campaigns.domain

object PathRules {
    val defaultIncludes = listOf("**/*.md")
    val defaultExcludes = listOf("**/.*", "**/.*/**", "**/node_modules/**", "**/build/**", "**/dist/**", "**/target/**", "**/coverage/**", "**/AGENTS.md", "**/CLAUDE.md")
    fun valid(pattern: String): Boolean = pattern.isNotBlank() && !pattern.startsWith("/") &&
        pattern.split('/').none { it == ".." || it == "." || it.isEmpty() } &&
        pattern.none { it == '\\' || it == ':' || it == '[' || it == ']' || it == '{' || it == '}' || it == '!' || it.isISOControl() } &&
        pattern.split('/').none { "**" in it && it != "**" }
}
