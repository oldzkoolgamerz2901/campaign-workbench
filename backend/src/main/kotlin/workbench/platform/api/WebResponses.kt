package workbench.platform.api

import arrow.core.Either
import org.springframework.http.HttpStatusCode
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity

fun <T> Either<Failure, T>.response(): ResponseEntity<*> = fold({ failure ->
    val status = when (failure) {
        is Failure.Invalid -> 400
        is Failure.NotFound -> 404
        is Failure.Conflict -> 409
        is Failure.Unreadable -> 422
    }
    ResponseEntity.status(status).body(ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status), failure.message).apply {
        title = failure.code
        setProperty("code", failure.code)
    })
}, { ResponseEntity.ok(it) })
