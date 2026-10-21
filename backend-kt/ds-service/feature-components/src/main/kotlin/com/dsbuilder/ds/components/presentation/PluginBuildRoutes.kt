package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.GetActivePluginBuildUseCase
import com.dsbuilder.ds.components.application.PublishPluginBuild
import com.dsbuilder.ds.components.application.PublishPluginBuildUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.ErrorResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveMultipart
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.utils.io.readRemaining
import kotlinx.io.readByteArray
import kotlinx.serialization.json.Json

private val lenientJson = Json { ignoreUnknownKeys = true }

/** Публикация билда плагина: архив и нормализованная мета одним multipart-запросом. */
@Suppress("ReturnCount", "LongMethod")
fun Route.pluginBuildPublishRoutes(
    evaluator: PolicyEvaluator,
    publish: PublishPluginBuildUseCase,
    maxArchiveBytes: Long,
) {
    route("/api/ds/admin/compose-preview") {
        post("/plugin-builds") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            // Роль проверяется до чтения тела: отказанный вызывающий ничего не загружает.
            if (!context.principal.systemAdmin && !context.principal.composePreviewPublisher) {
                return@post call.respondFailure(DsFailure.Forbidden)
            }
            val dryRun = call.request.queryParameters["dryRun"]?.toBooleanStrictOrNull() ?: true
            val upload = call.readPluginUpload(maxArchiveBytes)
            if (upload.tooLarge) {
                return@post call.respond(HttpStatusCode.PayloadTooLarge, ErrorResponse("Payload too large"))
            }
            val request = runCatching { lenientJson.decodeFromString<ImportApiMetaRequest>(upload.meta.orEmpty()) }
                .getOrNull()
                ?.takeIf { it.valid() && it.platform == PublishPluginBuildUseCase.PLATFORM }
            val bytes = upload.archive
            if (bytes == null || request == null) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            when (val result = publish.execute(context, PublishPluginBuild(bytes, request.toCommand(), dryRun))) {
                is DsResult.Success -> call.respond(PublishPluginBuildResponse.from(result.value, dryRun))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

/** Части multipart-запроса публикации. */
private class PluginUpload(val archive: ByteArray?, val meta: String?, val tooLarge: Boolean)

private suspend fun ApplicationCall.readPluginUpload(maxArchiveBytes: Long): PluginUpload {
    var archive: ByteArray? = null
    var meta: String? = null
    var tooLarge = false
    // Лимит парсера Ktor действует и на файловые части, поэтому он не ниже лимита архива; размер меты проверяется отдельно.
    receiveMultipart(formFieldLimit = maxOf(maxArchiveBytes, META_LIMIT_BYTES) + 1).forEachPart { part ->
        when {
            part.name == "plugin" && part is PartData.FileItem -> {
                val bytes = part.provider().readRemaining(maxArchiveBytes + 1).readByteArray()
                if (bytes.size.toLong() > maxArchiveBytes) tooLarge = true else archive = bytes
            }
            part.name == "meta" -> {
                val text = when (part) {
                    is PartData.FormItem -> part.value
                    is PartData.FileItem ->
                        part.provider().readRemaining(META_LIMIT_BYTES + 1).readByteArray().decodeToString()
                    else -> null
                }
                if (text != null && text.length > META_LIMIT_BYTES) tooLarge = true else meta = text
            }
        }
        part.dispose()
    }
    return PluginUpload(archive, meta, tooLarge)
}

/** Выдача адреса активного билда плагина участнику проекта. */
fun Route.activePluginBuildRoutes(evaluator: PolicyEvaluator, active: GetActivePluginBuildUseCase) {
    route("/api/ds/compose-preview") {
        get("/plugin") {
            // `versionId` намеренно не передаётся: активный билд не зависит от версии дизайн-системы.
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = active.execute(context)) {
                is DsResult.Success -> call.respond(ActivePluginBuildResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

private const val META_LIMIT_BYTES = 16L * 1024 * 1024
