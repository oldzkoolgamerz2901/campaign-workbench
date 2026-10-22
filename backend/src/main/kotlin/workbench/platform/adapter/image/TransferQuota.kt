package workbench.platform.adapter.image

import workbench.platform.api.*

/** Counts actual I/O bytes; subtraction avoids overflow when rejecting an oversized write. */
internal class TransferQuota(private val limit: Long, private val code: String, private val message: String) {
    private var used = 0L
    init { require(limit >= 0) }
    fun consume(bytes: Long) {
        require(bytes >= 0)
        if (bytes > limit - used) throw TransferFailure(Failure.Invalid(code, message))
        used += bytes
    }
}
