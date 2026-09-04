package com.dsbuilder.documentation.ingestion.presentation

import com.dsbuilder.documentation.ingestion.application.AcceptDocumentationBundleUseCase
import com.dsbuilder.documentation.ingestion.application.AcceptanceFailure
import com.dsbuilder.documentation.ingestion.application.AcceptanceResult
import com.dsbuilder.documentation.ingestion.application.BundleSource
import com.dsbuilder.documentation.ingestion.data.BoundedBundleUpload
import com.dsbuilder.documentation.ingestion.data.BundleInspectionException
import com.dsbuilder.documentation.ingestion.data.UploadLimitExceededException
import com.dsbuilder.documentation.ingestion.domain.ActorContext
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveMultipart
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import io.ktor.utils.io.jvm.javaio.toInputStream
import kotlinx.coroutines.CancellationException
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.nio.file.Files
import java.nio.file.Path

/** Регистрирует внутренний endpoint загрузки bundle. */
fun Route.documentationBundleRoutes(
    useCase: AcceptDocumentationBundleUseCase? = null,
    uploader: BoundedBundleUpload? = null,
) {
    val log = LoggerFactory.getLogger("DocumentationBundleAcceptance")
    post("/documentation/bundles") {
        call.acceptBundle(useCase, uploader, log)
    }
}

private suspend fun ApplicationCall.acceptBundle(
    useCase: AcceptDocumentationBundleUseCase?,
    uploader: BoundedBundleUpload?,
    log: Logger,
) {
    if (useCase == null || uploader == null) {
        return safeError(HttpStatusCode.ServiceUnavailable, "SERVICE_NOT_CONFIGURED", "Сервис приемки не настроен.")
    }
    val actor = TrustedActorContextMapper.map(request.headers)
        ?: return safeError(
            HttpStatusCode.BadRequest,
            "INVALID_TRUSTED_CONTEXT",
            "Обязательный trusted context отсутствует.",
        )
    var source: BundleSource? = null
    try {
        source = receiveBundle(uploader)
            ?: return safeError(
                HttpStatusCode.BadRequest,
                "INVALID_MULTIPART",
                "Ожидалась ровно одна file part bundle.",
            )
        respondTo(useCase.execute(source, actor), actor, log)
    } catch (_: UploadLimitExceededException) {
        safeError(
            HttpStatusCode.PayloadTooLarge,
            "COMPRESSED_SIZE_LIMIT",
            "Compressed bundle превышает лимит.",
        )
    } catch (error: BundleInspectionException) {
        safeError(error.failure.toHttpStatus(), error.code, error.message, error.bundlePath)
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        safeError(
            HttpStatusCode.ServiceUnavailable,
            "SERVICE_UNAVAILABLE",
            "Сервис временно недоступен.",
        )
    } finally {
        source?.let { runCatching { Files.deleteIfExists(Path.of(it.location)) } }
    }
}

private suspend fun ApplicationCall.receiveBundle(uploader: BoundedBundleUpload): BundleSource? {
    val sources = mutableListOf<BundleSource>()
    var unexpectedFile = false
    var acceptedSource: BundleSource? = null
    try {
        receiveMultipart().forEachPart { part ->
            try {
                if (part is PartData.FileItem && part.name == BUNDLE_PART_NAME) {
                    sources += uploader.receive(part.provider().toInputStream(), part.originalFileName)
                } else if (part is PartData.FileItem) {
                    unexpectedFile = true
                }
            } finally {
                part.dispose()
            }
        }
        acceptedSource = sources.singleOrNull()?.takeUnless { unexpectedFile }
        return acceptedSource
    } finally {
        if (acceptedSource == null) {
            sources.forEach { source -> runCatching { Files.deleteIfExists(Path.of(source.location)) } }
        }
    }
}

private suspend fun ApplicationCall.respondTo(result: AcceptanceResult, actor: ActorContext, log: Logger) {
    when (result) {
        is AcceptanceResult.Accepted -> {
            log.info(
                ACCEPTED_LOG,
                request.headers[REQUEST_ID_HEADER],
                actor.projectId,
                result.bundleId,
                result.jobId,
            )
            respond(HttpStatusCode.Accepted, BundleAcceptedResponse(result.bundleId, result.jobId))
        }
        is AcceptanceResult.Rejected -> {
            log.warn(
                REJECTED_LOG,
                request.headers[REQUEST_ID_HEADER],
                actor.projectId,
                result.errors.firstOrNull()?.code,
            )
            val errors = result.errors.map { AcceptanceErrorDto(it.code, it.message, it.path) }
            respond(result.failure.toHttpStatus(), AcceptanceErrorResponse(errors))
        }
    }
}

private const val BUNDLE_PART_NAME = "bundle"
private const val REQUEST_ID_HEADER = "X-Request-Id"
private const val ACCEPTED_LOG = "acceptance_result=accepted request_id={} project_id={} bundle_id={} job_id={}"
private const val REJECTED_LOG = "acceptance_result=rejected request_id={} project_id={} error_code={}"

private fun AcceptanceFailure.toHttpStatus(): HttpStatusCode = when (this) {
    AcceptanceFailure.INVALID_REQUEST -> HttpStatusCode.BadRequest
    AcceptanceFailure.FORBIDDEN -> HttpStatusCode.Forbidden
    AcceptanceFailure.NOT_FOUND -> HttpStatusCode.NotFound
    AcceptanceFailure.PAYLOAD_TOO_LARGE -> HttpStatusCode.PayloadTooLarge
    AcceptanceFailure.UNSUPPORTED_FORMAT -> HttpStatusCode.UnsupportedMediaType
    AcceptanceFailure.INVALID_CONTENT -> HttpStatusCode.UnprocessableEntity
    AcceptanceFailure.UNAVAILABLE -> HttpStatusCode.ServiceUnavailable
}

private suspend fun ApplicationCall.safeError(
    status: HttpStatusCode,
    code: String,
    message: String,
    path: String? = null,
) {
    respond(status, AcceptanceErrorResponse(listOf(AcceptanceErrorDto(code, message, path))))
}
