package workbench.writing.application

import workbench.writing.api.*
import workbench.writing.domain.Draft
import java.security.MessageDigest

internal fun draftData(d: Draft) = DraftData(d.id, d.campaign, d.card, d.revision,
    DraftFields(d.title, d.type, d.status, d.tags, d.summary, d.body, d.path),
    d.origin?.let { DraftOriginData(it.campaign, it.capture, it.path, it.card, it.raw, it.hash, it.retainedEnvelope, it.issues, it.interpretation) },
    d.recovery?.let { RecoveryOriginData(it.workspace, it.campaign, it.draft, it.card, it.revision) }, d.image)

internal fun withinWorkingLimits(f: DraftFields) = listOf(f.title, f.summary, f.body, f.path).all { it.toByteArray(Charsets.UTF_8).size <= 2 * 1024 * 1024 } &&
    f.tags.size <= 128 && f.tags.all { it.toByteArray(Charsets.UTF_8).size <= 4096 } && f.type.length <= 64 && f.status.length <= 64

internal fun exportPathErrors(path: String): List<String> = if (path.isBlank() || path.length > 4096 || path.startsWith('/') ||
    path.any { it == '\\' || it == ':' || it == '?' || it == '#' || it.isISOControl() } ||
    path.split('/').any { it.isEmpty() || it == "." || it == ".." } || !path.endsWith(".md", true))
    listOf("Choose a campaign-relative .md path without root/drive, control, query, fragment, empty, dot or parent segments.") else emptyList()

internal fun contentHash(text: String) = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
