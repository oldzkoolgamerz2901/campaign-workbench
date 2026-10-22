package workbench.writing.adapter.web

import arrow.core.Either
import arrow.core.flatMap
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.*
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.DeserializationFeature
import workbench.platform.api.*
import workbench.writing.api.*
import workbench.writing.application.*
import java.util.UUID

data class ArtworkUpload(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON SaveDraft with revision, fields and imageAction=replace") val metadata: String,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED, type = "string", format = "binary") val image: org.springframework.core.io.Resource)

@RestController
@ApiResponse(responseCode = "400", content = [Content(schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "404", content = [Content(schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "409", content = [Content(schema = Schema(implementation = ProblemResponse::class))])
@ApiResponse(responseCode = "422", content = [Content(schema = Schema(implementation = ProblemResponse::class))])
class ArtworkController(private val writing: WritingService, private val artwork: ArtworkService, private val mapper: ObjectMapper) {
    @PostMapping("/api/campaigns/{campaign}/drafts/{id}/artwork", consumes = ["multipart/form-data"], produces = ["application/json"])
    @Operation(operationId = "replaceDraftArtwork")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = [Content(mediaType = "multipart/form-data", schema = Schema(implementation = ArtworkUpload::class))])
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(implementation = DraftData::class))])
    fun replace(@PathVariable campaign: UUID, @PathVariable id: UUID, request: HttpServletRequest): org.springframework.http.ResponseEntity<*> {
        val parsed: Either<Failure, Pair<SaveDraft, jakarta.servlet.http.Part>> = try {
            val parts = request.parts.toList()
            require(parts.size == 2 && parts.map { it.name }.toSet() == setOf("metadata", "image"))
            val metadata = parts.single { it.name == "metadata" }; val image = parts.single { it.name == "image" }
            require(metadata.size <= 10 * 1024 * 1024 && image.size in 1..ImageLimits.ORIGINAL_BYTES)
            val bytes = metadata.inputStream.use { it.readNBytes(10 * 1024 * 1024 + 1) }; require(bytes.size <= 10 * 1024 * 1024)
            val tree = mapper.reader().with(tools.jackson.core.StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes)
            require(tree.isObject && tree.properties().map { it.key }.toSet() == setOf("revision", "fields", "imageAction"))
            require(tree.path("revision").isIntegralNumber && tree.path("revision").canConvertToLong() && tree.path("revision").longValue() >= 0)
            val fields = tree.path("fields")
            val strings = setOf("title", "type", "status", "summary", "body", "path")
            require(fields.isObject && fields.properties().map { it.key }.toSet() == strings + "tags")
            require(strings.all { fields.path(it).isString } && fields.path("tags").isArray && fields.path("tags").all { it.isString })
            require(tree.path("imageAction").isString)
            val command = mapper.readerFor(SaveDraft::class.java).with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue<SaveDraft>(bytes)
            require(command.imageAction == "replace")
            Either.Right(command to image)
        } catch (_: Exception) { Either.Left(Failure.Invalid("image.request", "Supply one image and valid saved-revision metadata within the upload limits.")) }
        return parsed.flatMap { (command, image) -> image.inputStream.use { writing.replaceImage(campaign, id, command, it) } }.response()
    }
    @GetMapping("/api/campaigns/{campaign}/drafts/{id}/artwork/{variant}", produces = ["image/jpeg", "image/png"])
    @Operation(operationId = "getDraftArtwork")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(type = "string", format = "binary"))])
    fun draft(@PathVariable campaign: UUID, @PathVariable id: UUID, @PathVariable variant: ImageVariant, @RequestHeader("If-None-Match", required = false) etag: String?) = artwork.draft(campaign, id, variant).imageResponse(etag)

    @GetMapping("/api/campaigns/{campaign}/drafts/{id}/approved/{revision}/artwork/{variant}", produces = ["image/jpeg", "image/png"])
    @Operation(operationId = "getApprovedArtwork")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(type = "string", format = "binary"))])
    fun approved(@PathVariable campaign: UUID, @PathVariable id: UUID, @PathVariable revision: Long, @PathVariable variant: ImageVariant, @RequestHeader("If-None-Match", required = false) etag: String?) = artwork.approved(campaign, id, revision, variant).imageResponse(etag)

    @GetMapping("/api/campaigns/{campaign}/drafts/{id}/exports/{artifact}/artwork/{variant}", produces = ["image/jpeg", "image/png"])
    @Operation(operationId = "getExportArtwork")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(type = "string", format = "binary"))])
    fun exported(@PathVariable campaign: UUID, @PathVariable id: UUID, @PathVariable artifact: UUID, @PathVariable variant: ImageVariant, @RequestHeader("If-None-Match", required = false) etag: String?) = artwork.exported(campaign, id, artifact, variant).imageResponse(etag)

    @GetMapping("/api/writing-recovery/{id}/artwork/{variant}", produces = ["image/jpeg", "image/png"])
    @Operation(operationId = "getRecoveredArtwork")
    @ApiResponse(responseCode = "200", content = [Content(schema = Schema(type = "string", format = "binary"))])
    fun recovered(@PathVariable id: UUID, @RequestParam key: String, @PathVariable variant: ImageVariant, @RequestHeader("If-None-Match", required = false) etag: String?) = artwork.recovered(id, key, variant).imageResponse(etag)
}
