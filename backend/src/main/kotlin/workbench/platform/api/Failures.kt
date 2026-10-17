package workbench.platform.api

import arrow.core.Either

sealed interface Failure {
    val code: String
    val message: String
    data class Invalid(override val code: String, override val message: String) : Failure
    data class NotFound(override val code: String, override val message: String) : Failure
    data class Conflict(override val code: String, override val message: String) : Failure
    data class Unreadable(override val code: String, override val message: String) : Failure
}

interface Transactions {
    fun <T> run(block: () -> Either<Failure, T>): Either<Failure, T>
}
