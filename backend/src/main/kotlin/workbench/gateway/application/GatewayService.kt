package workbench.gateway.application

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.raise.ensure
import arrow.core.raise.ensureNotNull
import workbench.campaigns.api.CampaignSelection
import workbench.gateway.api.GatewayStatus
import workbench.platform.api.Failure
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** Serializes lifecycle/selection, but never holds admission's lock during IO or a transaction. */
class GatewayService(private val selection: CampaignSelection, private val listener: GatewayListener, private val drainMillis: Long) {
    init { require(drainMillis > 0) }
    private val controls = ReentrantLock()
    private val admission = ReentrantLock()
    private val drained = admission.newCondition()
    private var activation: Activation? = null
    private var active = 0
    private data class Activation(val id: UUID, val campaign: UUID, val port: Int)

    fun status(): GatewayStatus = admission.withLock {
        GatewayStatus(activation != null, activation?.campaign, activation?.port, active)
    }

    fun enable(): Either<Failure, GatewayStatus> = controls.withLock { either {
        if (status().enabled) return@either status()
        ensure(status().activeRequests == 0) { conflict("gateway.draining", "Previous player operations are still finishing.") }
        val campaign = ensureNotNull(selection.selected().bind()) { conflict("gateway.no-campaign", "Select a campaign before enabling the gateway.") }
        val port = listener.open().bind()
        admission.withLock { activation = Activation(UUID.randomUUID(), campaign, port) }
        status()
    } }

    fun disable(): Either<Failure, GatewayStatus> = controls.withLock { either {
        stop().bind(); status()
    } }

    /** Selection starts its own transaction only after old requests have completed. */
    fun select(campaign: UUID) = controls.withLock { either {
        val current = selection.selected().bind()
        if (current != campaign) stop().bind()
        selection.select(campaign).bind()
    } }

    private fun stop(): Either<Failure, Unit> {
        var interrupted = false
        val complete = admission.withLock {
            activation = null
            var remaining = java.util.concurrent.TimeUnit.MILLISECONDS.toNanos(drainMillis)
            try {
                while (active > 0 && remaining > 0) remaining = drained.awaitNanos(remaining)
            } catch (_: InterruptedException) { interrupted = true }
            active == 0 && !interrupted
        }
        val closed = listener.close()
        if (interrupted) Thread.currentThread().interrupt()
        return if (!complete) Either.Left(conflict("gateway.drain-timeout", "Player operations did not finish; the gateway is closed and campaign selection was not changed.")) else closed
    }

    /** Captures campaign and activation once. Release only after synchronous transaction completion. */
    fun admit(): Operation? = admission.withLock {
        val current = activation ?: return null
        active++
        Operation(current.campaign, current.id) {
            admission.withLock { active--; if (active == 0) drained.signalAll() }
        }
    }

    class Operation internal constructor(val campaign: UUID, val activation: UUID, private val release: () -> Unit) : AutoCloseable {
        private val closed = AtomicBoolean()
        override fun close() { if (closed.compareAndSet(false, true)) release() }
    }

    fun shutdown() { disable() }
    private fun conflict(code: String, message: String) = Failure.Conflict(code, message)
}
