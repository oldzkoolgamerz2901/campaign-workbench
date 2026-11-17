package workbench.sharing.application

import workbench.sharing.api.*

/** The single content policy for every player response and player layout calculation. */
internal fun SharedCardData.forPlayer(): SharedCardData = if (backRevealed) this else copy(
    visible = SharedCardContent(title = visible.title, type = visible.type, quote = visible.quote))

internal fun SharedCollection.forPlayer() = copy(cards = cards.map { it.forPlayer() })
