package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import workbench.playthroughs.domain.*
import workbench.playthroughs.api.CardLocation
import java.util.UUID

class PlayWorkspaceTest : StringSpec({
    "placements cover membership once and covers belong to nonempty piles" {
        val ids = List(5) { UUID.randomUUID() }
        val w = PlayWorkspace(UUID.randomUUID(), 4, listOf(ids[0]), listOf(ids[1]), ids[2],
            RuntimePile("Enemies", listOf(ids[3], ids[4]), ids[4]))
        w.valid(ids, setOf(ids[2])) shouldBe true
        w.copy(sessionCards = listOf(ids[0], ids[3])).valid(ids, setOf(ids[2])) shouldBe false
        w.copy(pile1 = w.pile1.copy(cover = ids[0])).valid(ids, setOf(ids[2])) shouldBe false
        w.copy(pile2 = RuntimePile(cover = ids[0])).valid(ids, setOf(ids[2])) shouldBe false
        w.copy(pile1 = w.pile1.copy(name = " ")).valid(ids, setOf(ids[2])) shouldBe false
        w.valid(ids, emptySet()) shouldBe false
    }
    "cover removal advances in former order and wraps; reorder retains cover" {
        val ids = List(3) { UUID.randomUUID() }
        val pile = RuntimePile(items = ids, cover = ids[1])
        pile.retaining(setOf(ids[0], ids[2])).cover shouldBe ids[2]
        pile.copy(cover = ids[2]).retaining(setOf(ids[0], ids[1])).cover shouldBe ids[0]
        pile.retaining(emptySet()).cover shouldBe null
        val w = PlayWorkspace(UUID.randomUUID(), 1, emptyList(), emptyList(), pile1 = pile)
        w.withItems(CardLocation.PILE_1, ids.reversed()).pile1.cover shouldBe ids[1]
        w.move(ids[1], CardLocation.USED, null).pile1.cover shouldBe ids[2]
        w.move(ids[1], CardLocation.PILE_2, null).pile2.cover shouldBe ids[1]
    }
    "reconcile additions removals and invalid Scene without stealing covers" {
        val ids = List(6) { UUID.randomUUID() }
        val w = PlayWorkspace(UUID.randomUUID(), 8, listOf(ids[0]), listOf(ids[1]), ids[2],
            RuntimePile(items = listOf(ids[3], ids[4]), cover = ids[4]))
        w.reconcile(ids.take(5).reversed(), setOf(ids[2])) shouldBe w
        val next = w.reconcile(listOf(ids[0], ids[2], ids[3], ids[5]), emptySet())
        next.sessionCards shouldBe listOf(ids[5], ids[2], ids[0])
        next.used shouldBe emptyList()
        next.activeSceneItemId shouldBe null
        next.pile1.items shouldBe listOf(ids[3])
        next.pile1.cover shouldBe ids[3]
        next.revision shouldBe 9
        next.valid(listOf(ids[0], ids[2], ids[3], ids[5]), emptySet()) shouldBe true
        next.reconcile(listOf(ids[0], ids[2], ids[3], ids[5]), emptySet()) shouldBe next
    }
})
