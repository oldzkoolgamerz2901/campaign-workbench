package workbench.platform.adapter.web

import org.slf4j.LoggerFactory
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.dao.DataIntegrityViolationException
import java.util.UUID

@RestControllerAdvice
class UnexpectedFailures {
    private val log = LoggerFactory.getLogger(javaClass)
    @ExceptionHandler(org.springframework.web.multipart.MultipartException::class, HttpMessageNotReadableException::class, MethodArgumentTypeMismatchException::class, MissingServletRequestParameterException::class)
    fun malformed(ex: Exception) = ResponseEntity.badRequest().body(problem(400, "request.invalid", "Invalid request fields."))
    @ExceptionHandler(DataIntegrityViolationException::class)
    fun conflict(ex: Exception) = ResponseEntity.status(409).body(problem(409, "record.conflict", "The record conflicts with an existing or newer record."))
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException::class)
    fun missingRoute(ex: Exception) = ResponseEntity.status(404).body(problem(404, "request.not-found", "Requested resource not found."))
    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException::class)
    fun unsupportedMethod(ex: org.springframework.web.HttpRequestMethodNotSupportedException) = ResponseEntity.status(405)
        .header("Allow", *(ex.supportedMethods ?: emptyArray()))
        .body(problem(405, "request.method-not-allowed", "This operation is not supported for the requested resource."))
    @ExceptionHandler(Exception::class)
    fun unexpected(ex: Exception): ResponseEntity<ProblemDetail> {
        val id = UUID.randomUUID().toString()
        log.error("Unexpected failure {} ({})", id, ex.javaClass.simpleName)
        return ResponseEntity.internalServerError().body(problem(500, "request.failed", "The operation failed. Please retry.").apply { setProperty("correlationId", id) })
    }
    private fun problem(status: Int, code: String, message: String) = ProblemDetail.forStatusAndDetail(org.springframework.http.HttpStatusCode.valueOf(status), message).apply {
        title = code; setProperty("code", code)
    }
}
