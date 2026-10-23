package workbench.preparation.application

import workbench.preparation.domain.Session
import workbench.preparation.domain.PreparedItem
import workbench.preparation.api.RenderedMarkdown
import java.util.UUID

interface SessionStore {
    fun archiveBytes(campaign: UUID, ids: List<UUID>): Long
    fun list(campaign: UUID): List<Session>
    fun get(campaign: UUID, id: UUID): Session?
    fun put(session: Session)
}
interface PreparationMarkdown {
    fun targets(origin: PreparedItem, items: List<PreparedItem>, index: Int, destination: String): List<workbench.preparation.api.PreparedTarget>
    fun render(text: String): RenderedMarkdown
    fun captured(items: List<PreparedItem>): Map<UUID, RenderedMarkdown>
}
