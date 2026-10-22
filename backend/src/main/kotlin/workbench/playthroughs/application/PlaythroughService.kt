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
    private fun PlayWorkspace.data() = WorkspaceData(session, revision, active, used)
    private fun invalid() = Failure.Invalid("playthroughs.invalid-table", "Table cards must be unique and cover exactly the current prepared membership.")
    override fun open(campaign: UUID, session: UUID): Either<Failure, WorkspaceData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val ids = preparation.snapshot(campaign, session).bind().items.map { it.id }
        val before = store.get(session)
        val after = before?.reconcile(ids) ?: PlayWorkspace(session, 0, ids, emptyList())
        if (after != before) store.put(after)
        after.data()
    } }
    override fun save(campaign: UUID, session: UUID, request: SaveWorkspace): Either<Failure, WorkspaceData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val ids = preparation.snapshot(campaign, session).bind().items.map { it.id }
        val before = ensureNotNull(store.get(session)) { Failure.Conflict("playthroughs.not-opened", "Open the workspace before saving.") }
        val current = before.reconcile(ids)
        ensure(request.revision == current.revision) { Failure.Conflict("playthroughs.stale-revision", "The workspace or its membership changed. Reload explicitly; local edits are retained.") }
        val after = PlayWorkspace(session, current.revision + 1, request.active, request.used)
        ensure(after.valid(ids)) { invalid() }
        store.put(after)
        after.data()
    } }
    override fun snapshot(campaign: UUID, session: UUID): Either<Failure, WorkspaceData?> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val ids = preparation.snapshot(campaign, session).bind().items.map { it.id }
        val before = store.get(session)
        val after = before?.reconcile(ids)
        if (after != null && after != before) store.put(after)
        after?.data()
    } }
    override fun restore(campaign: UUID, session: UUID, workspace: WorkspaceData?): Either<Failure, Unit> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val ids = preparation.snapshot(campaign, session).bind().items.map { it.id }
        ensure(store.get(session) == null) { Failure.Conflict("playthroughs.already-exists", "Restore requires a fresh session.") }
        if (workspace != null) {
            val restored = PlayWorkspace(session, 0, workspace.active, workspace.used)
            ensure(workspace.session == session && restored.valid(ids)) { invalid() }
            store.put(restored)
        }
    } }
}
