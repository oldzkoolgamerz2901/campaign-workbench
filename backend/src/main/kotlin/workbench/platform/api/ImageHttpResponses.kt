package workbench.platform.api

import arrow.core.Either
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.core.io.InputStreamResource
import java.io.FilterInputStream

fun Either<Failure, ImageDerivative>.imageResponse(ifNoneMatch: String?): ResponseEntity<*> = fold(
    { Either.Left(it).response() }, { image ->
        val etag = "\"${image.content.sha256}\""
        val headers = ResponseEntity.status(if (ifNoneMatch?.split(',')?.any { it.trim().removePrefix("W/") in setOf(etag, "*") } == true) 304 else 200)
            .eTag(etag).header("Cache-Control", "private, no-cache").header("X-Content-Type-Options", "nosniff")
        if (ifNoneMatch?.split(',')?.any { it.trim().removePrefix("W/") in setOf(etag, "*") } == true) headers.build<Void>()
        else headers.contentType(MediaType.parseMediaType(image.mime)).body(image.content.copy())
    })

fun Either<Failure, PortableDownload>.downloadResponse(name: String): ResponseEntity<*> = fold(
    { Either.Left(it).response() }, { file ->
        try {
            val size = file.size
            val input = object : FilterInputStream(file.input()) {
                override fun close() { try { super.close() } finally { file.close() } }
            }
            ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip")).contentLength(size)
                .header("Content-Disposition", "attachment; filename=$name")
                .body(InputStreamResource(input))
        } catch (e: Exception) { file.close(); throw e }
    })
