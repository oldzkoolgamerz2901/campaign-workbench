package workbench.sharing.domain

/** Disclosure is permanent and independent of card orientation and placement. */
enum class BackDisclosure {
    UNREVEALED, REVEALED;

    fun reveal() = REVEALED
}
