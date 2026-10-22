package workbench.playthroughs.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.preparation.api.PreparedSessions
import workbench.playthroughs.api.*
import workbench.playthroughs.domain.PlayWorkspace
import java.util.UUID

class PlaythroughService(private val campaigns: Campaigns, private val preparation: PreparedSessions,
    private val store: WorkspaceStore, private val tx: Transactions) : Playthroughs, WorkspaceTransfers {
    private fun PlayWorkspace.data() = WorkspaceData(session, revision, active, used, activeSceneItemId, focusedItemIds)
    private fun sceneIds(items: List<workbench.preparation.api.PreparedItemData>) = items.filter { item ->
        item.capturedSource?.classification?.let { c -> c.metadata?.type == "scene" && c.issues.none { it.severity == "error" } } == true
    }.map { it.id }.toSet()
    private fun invalid() = Failure.Invalid("playthroughs.invalid-table", "Table cards must cover current membership exactly; focus requires up to three unique prepared cards and the active scene must be a prepared Scene.")
    override fun open(campaign: UUID, session: UUID): Either<Failure, WorkspaceData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val items = preparation.snapshot(campaign, session).bind().items
        val ids = items.map { it.id }
        val scenes = sceneIds(items)
        val before = store.get(session)
        val after = before?.reconcile(ids, scenes) ?: PlayWorkspace(session, 0, ids, emptyList())
        if (after != before) store.put(after)
        after.data()
    } }
    override fun save(campaign: UUID, session: UUID, request: SaveWorkspace): Either<Failure, WorkspaceData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val items = preparation.snapshot(campaign, session).bind().items
        val ids = items.map { it.id }
        val scenes = sceneIds(items)
        val before = ensureNotNull(store.get(session)) { Failure.Conflict("playthroughs.not-opened", "Open the workspace before saving.") }
        val current = before.reconcile(ids, scenes)
        ensure(request.revision == current.revision) { Failure.Conflict("playthroughs.stale-revision", "The workspace or its membership changed. Reload explicitly; local edits are retained.") }
        val after = PlayWorkspace(session, current.revision + 1, request.active, request.used, request.activeSceneItemId, request.focusedItemIds)
        ensure(after.valid(ids, scenes)) { invalid() }
        store.put(after)
        after.data()
    } }
    override fun snapshot(campaign: UUID, session: UUID): Either<Failure, WorkspaceData?> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val items = preparation.snapshot(campaign, session).bind().items
        val ids = items.map { it.id }
        val scenes = sceneIds(items)
        val before = store.get(session)
        val after = before?.reconcile(ids, scenes)
        if (after != null && after != before) store.put(after)
        after?.data()
    } }
    override fun restore(campaign: UUID, session: UUID, workspace: WorkspaceData?): Either<Failure, Unit> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val items = preparation.snapshot(campaign, session).bind().items
        val ids = items.map { it.id }
        val scenes = sceneIds(items)
        ensure(store.get(session) == null) { Failure.Conflict("playthroughs.already-exists", "Restore requires a fresh session.") }
        if (workspace != null) {
            val restored = PlayWorkspace(session, 0, workspace.active, workspace.used, workspace.activeSceneItemId, workspace.focusedItemIds)
            ensure(workspace.session == session && restored.valid(ids, scenes)) { invalid() }
            store.put(restored)
        }
    } }
}
