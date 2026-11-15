package workbench.platform.api

import arrow.core.Either
import org.springframework.http.HttpStatusCode
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity

fun <T> Either<Failure, T>.response(noStore: Boolean = false): ResponseEntity<*> {
    val response = fold({ failure ->
    val status = when (failure) {
        is Failure.Invalid -> 400
        is Failure.NotFound -> 404
        is Failure.Conflict -> 409
        is Failure.Unreadable -> 422
        is Failure.Unauthenticated -> 401
        is Failure.Forbidden -> 403
    }
    val builder = ResponseEntity.status(status).contentType(org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON)
    if (failure is Failure.Unauthenticated) builder.header("WWW-Authenticate", "Bearer")
    builder.body(ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status), failure.message).apply {
        title = failure.code
        setProperty("code", failure.code)
    })
}, { ResponseEntity.ok(it) })
    return if (noStore) ResponseEntity.status(response.statusCode).headers(response.headers)
        .cacheControl(org.springframework.http.CacheControl.noStore()).body(response.body) else response
}
