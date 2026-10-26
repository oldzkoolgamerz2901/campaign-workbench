package workbench.playthroughs.application

import arrow.core.Either
import arrow.core.raise.*
import workbench.campaigns.api.Campaigns
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.playthroughs.api.*
import workbench.playthroughs.domain.*
import java.util.UUID

class PlaythroughService(private val campaigns: Campaigns, private val preparation: PreparedSessions,
    private val store: WorkspaceStore, private val tx: Transactions) : Playthroughs, WorkspaceTransfers {
    private fun RuntimePile.data() = PileData(name, items, cover)
    private fun PlayWorkspace.data() = WorkspaceData(session, revision, sessionCards, used, activeSceneItemId, pile1.data(), pile2.data())
    private fun WorkspaceData.domain() = PlayWorkspace(session, revision, sessionCards, used, activeSceneItemId,
        RuntimePile(pile1.name, pile1.items, pile1.cover), RuntimePile(pile2.name, pile2.items, pile2.cover))
    private fun sceneIds(items: List<PreparedItemData>) = items.filter { item ->
        item.capturedSource?.classification?.let { c -> c.metadata?.type == "scene" && c.issues.none { it.severity == "error" } } == true
    }.map { it.id }.toSet()
    private fun invalid() = Failure.Invalid("playthroughs.invalid-command", "Choose a valid prepared card, location, pile position or Scene transition.")
    private fun related(snapshot: SessionData, scene: UUID): List<UUID> {
        val ids = snapshot.sceneLinks.filter { it.scene == scene }.map { it.item }.toSet()
        return snapshot.items.filter { it.id in ids }.map { it.id }
    }
    override fun suggestions(campaign: UUID, session: UUID, scene: UUID): Either<Failure, RelationshipSuggestions> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val snapshot = preparation.snapshot(campaign, session).bind()
        ensure(scene in sceneIds(snapshot.items)) { invalid() }
        RelationshipSuggestions(scene, related(snapshot, scene).map { id ->
            RelationshipSuggestion("scene-item-$id", snapshot.items.first { it.id == id }.title, PreparedTargetState.MATCHED, listOf(PreparedTarget(id, null)))
        })
    } }
    private fun opened(session: UUID, snapshot: SessionData): PlayWorkspace {
        val before = store.get(session)
        val after = before?.reconcile(snapshot.items.map { it.id }, sceneIds(snapshot.items))
            ?: PlayWorkspace(session, 0, snapshot.items.map { it.id }, emptyList())
        if (after != before) store.put(after)
        return after
    }
    override fun open(campaign: UUID, session: UUID): Either<Failure, WorkspaceData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        opened(session, preparation.snapshot(campaign, session).bind()).data()
    } }
    override fun overview(campaign: UUID, session: UUID, scene: UUID): Either<Failure, SceneOverview> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val snapshot = preparation.snapshot(campaign, session).bind()
        ensure(scene in sceneIds(snapshot.items)) { invalid() }
        SceneOverview(opened(session, snapshot).data(), snapshot.revision, scene, related(snapshot, scene))
    } }
    private fun mutate(campaign: UUID, session: UUID, revision: Long,
        change: Raise<Failure>.(PlayWorkspace, SessionData) -> PlayWorkspace): Either<Failure, WorkspaceData> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val snapshot = preparation.snapshot(campaign, session).bind()
        val before = ensureNotNull(store.get(session)) { Failure.Conflict("playthroughs.not-opened", "Open the workspace before changing it.") }
        val current = before.reconcile(snapshot.items.map { it.id }, sceneIds(snapshot.items))
        ensure(revision == current.revision) { Failure.Conflict("playthroughs.stale-revision", "Workspace membership or arrangement changed. Reload explicitly; local choices are retained.") }
        val next = change(current, snapshot)
        ensure(next.valid(snapshot.items.map { it.id }, sceneIds(snapshot.items))) { invalid() }
        val after = if (next == current) current else next.copy(revision = current.revision + 1)
        if (after != before) store.put(after)
        after.data()
    } }
    private fun Raise<Failure>.moving(w: PlayWorkspace, item: UUID, destination: CardLocation, index: Int?): PlayWorkspace {
        ensure(item in w.all() && item != w.activeSceneItemId) { invalid() }
        val count = w.items(destination).count { it != item }
        ensure(index == null || index in 0..count) { invalid() }
        // Same-location movement is reordering; preserve the displayed cover.
        val moved = w.move(item, destination, index)
        return when {
            item in w.pile1.items && destination == CardLocation.PILE_1 -> moved.copy(pile1 = moved.pile1.copy(cover = w.pile1.cover))
            item in w.pile2.items && destination == CardLocation.PILE_2 -> moved.copy(pile2 = moved.pile2.copy(cover = w.pile2.cover))
            else -> moved
        }
    }
    override fun move(campaign: UUID, session: UUID, request: MoveCard) = mutate(campaign, session, request.revision) { w, _ ->
        moving(w, request.item, request.destination, request.index)
    }
    override fun reorder(campaign: UUID, session: UUID, request: ReorderCards) = mutate(campaign, session, request.revision) { w, _ ->
        ensure(request.items.distinct().size == request.items.size && request.items.toSet() == w.items(request.location).toSet()) { invalid() }
        w.withItems(request.location, request.items)
    }
    override fun cover(campaign: UUID, session: UUID, request: ChooseCover) = mutate(campaign, session, request.revision) { w, _ ->
        val pile = if (request.pile == PileSlot.PILE_1) w.pile1 else w.pile2
        ensure(request.item in pile.items) { invalid() }
        if (request.pile == PileSlot.PILE_1) w.copy(pile1 = pile.copy(cover = request.item)) else w.copy(pile2 = pile.copy(cover = request.item))
    }
    override fun rename(campaign: UUID, session: UUID, request: RenamePile) = mutate(campaign, session, request.revision) { w, _ ->
        ensure(request.name == null || (request.name.isNotBlank() && request.name.length <= 200)) { invalid() }
        if (request.pile == PileSlot.PILE_1) w.copy(pile1 = w.pile1.copy(name = request.name)) else w.copy(pile2 = w.pile2.copy(name = request.name))
    }
    override fun transition(campaign: UUID, session: UUID, request: TransitionScene) = mutate(campaign, session, request.revision) { w, snapshot ->
        ensure(request.preparationRevision == snapshot.revision) { Failure.Conflict("playthroughs.stale-scene-context", "Preparation changed. Refresh the Scene overview and review retained choices.") }
        ensure(request.scene == null || request.scene in sceneIds(snapshot.items)) { invalid() }
        ensure(request.movements.size <= 1000 && request.movements.map { it.item }.distinct().size == request.movements.size) { invalid() }
        val allowed = w.pile1.items + w.pile2.items + (request.scene?.let { related(snapshot, it) } ?: emptyList())
        ensure(request.movements.all { it.item in allowed && it.item != request.scene && it.item != w.activeSceneItemId }) { invalid() }
        var next = w
        if (request.scene != w.activeSceneItemId) {
            next = next.copy(activeSceneItemId = null)
            w.activeSceneItemId?.let { next = next.copy(sessionCards = listOf(it) + next.sessionCards) }
            request.scene?.let { next = next.without(it).copy(activeSceneItemId = it) }
        }
        for (movement in request.movements) next = moving(next, movement.item, movement.destination, movement.index)
        next
    }
    override fun snapshot(campaign: UUID, session: UUID): Either<Failure, WorkspaceData?> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val snapshot = preparation.snapshot(campaign, session).bind()
        if (store.get(session) == null) null else opened(session, snapshot).data()
    } }
    override fun validate(workspace: WorkspaceData, membership: List<UUID>, scenes: Set<UUID>) = workspace.domain().valid(membership, scenes)
    override fun restore(campaign: UUID, session: UUID, workspace: WorkspaceData?): Either<Failure, Unit> = tx.run { either {
        campaigns.configuration(campaign).bind()
        val snapshot = preparation.snapshot(campaign, session).bind()
        ensure(store.get(session) == null) { Failure.Conflict("playthroughs.already-exists", "Restore requires a fresh session.") }
        if (workspace != null) {
            ensure(workspace.session == session && validate(workspace, snapshot.items.map { it.id }, sceneIds(snapshot.items))) { invalid() }
            store.put(workspace.domain().copy(revision = 0))
        }
    } }
}
