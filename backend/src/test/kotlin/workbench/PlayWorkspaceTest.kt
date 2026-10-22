package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import workbench.playthroughs.domain.PlayWorkspace
import java.util.UUID

class PlayWorkspaceTest : StringSpec({
    "focus accepts three prepared cards including Used, but rejects four distinct prepared cards" {
        val members = List(4) { UUID.randomUUID() }
        val workspace = PlayWorkspace(UUID.randomUUID(), 3, members.take(2), members.drop(2),
            members[0], listOf(members[2], members[0], members[3]))
        workspace.valid(members, setOf(members[0])) shouldBe true
        workspace.copy(focusedItemIds = members).valid(members, setOf(members[0])) shouldBe false
        workspace.copy(focusedItemIds = listOf(members[0], members[0])).valid(members, setOf(members[0])) shouldBe false
        workspace.copy(activeSceneItemId = members[1]).valid(members, setOf(members[0])) shouldBe false
    }

    "reconciliation retains focus order and changes revision only when membership or scene validity changes" {
        val members = List(4) { UUID.randomUUID() }
        val workspace = PlayWorkspace(UUID.randomUUID(), 7, members.take(2), listOf(members[2]),
            members[0], listOf(members[2], members[0], members[1]))
        workspace.reconcile(members.take(3).reversed(), setOf(members[0])) shouldBe workspace
        val reconciled = workspace.reconcile(members.drop(1), emptySet())
        reconciled.active shouldBe listOf(members[3], members[1])
        reconciled.used shouldBe listOf(members[2])
        reconciled.focusedItemIds shouldBe listOf(members[2], members[1])
        reconciled.activeSceneItemId shouldBe null
        reconciled.revision shouldBe 8
        reconciled.reconcile(members.drop(1), emptySet()) shouldBe reconciled
        val invalidScene = workspace.reconcile(members.take(3), emptySet())
        invalidScene.activeSceneItemId shouldBe null
        invalidScene.focusedItemIds shouldBe workspace.focusedItemIds
        invalidScene.revision shouldBe 8
    }
})
