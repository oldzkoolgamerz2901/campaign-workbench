package workbench.gateway.application

import arrow.core.Either
import workbench.platform.api.Failure

/** Transport port. Binding and connector cleanup are owned by the adapter. */
interface GatewayListener {
    fun open(): Either<Failure, Int>
    fun close(): Either<Failure, Unit>
}
