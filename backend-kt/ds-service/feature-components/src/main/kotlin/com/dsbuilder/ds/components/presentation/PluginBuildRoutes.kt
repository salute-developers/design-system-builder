package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.GetActivePluginBuildUseCase
import com.dsbuilder.ds.components.application.PublishPluginBuild
import com.dsbuilder.ds.components.application.PublishPluginBuildUseCase
import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
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

/** Каталог маршрутов платформы: `compose-preview` или `web-preview`. */
private val PreviewPluginPlatform.routeSegment: String
    get() = when (this) {
        PreviewPluginPlatform.COMPOSE -> "compose-preview"
        PreviewPluginPlatform.WEB -> "web-preview"
    }

/**
 * Публикация билда плагина: архив и нормализованная мета одним multipart-запросом. Маршруты Compose и web
 * параллельны и различаются только платформой; ответ Compose сохраняет прежний формат.
 */
fun Route.pluginBuildPublishRoutes(
    evaluator: PolicyEvaluator,
    publish: PublishPluginBuildUseCase,
    maxArchiveBytes: Long,
) {
    PreviewPluginPlatform.entries.forEach { platform ->
        pluginBuildPublishRoute(
            platform,
            evaluator,
            publish,
            maxArchiveBytes,
        )
    }
}

@Suppress("ReturnCount", "LongMethod")
private fun Route.pluginBuildPublishRoute(
    platform: PreviewPluginPlatform,
    evaluator: PolicyEvaluator,
    publish: PublishPluginBuildUseCase,
    maxArchiveBytes: Long,
) {
    route("/api/ds/admin/${platform.routeSegment}") {
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
                ?.takeIf { it.valid() && it.platform == platform.wire }
            val bytes = upload.archive
            if (bytes == null || request == null) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = PublishPluginBuild(bytes, request.toCommand(), dryRun)
            when (val result = publish.execute(platform, context, command)) {
                is DsResult.Success -> when (platform) {
                    PreviewPluginPlatform.COMPOSE -> call.respond(PublishPluginBuildResponse.from(result.value, dryRun))
                    PreviewPluginPlatform.WEB -> call.respond(PublishWebPluginBuildResponse.from(result.value, dryRun))
                }
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

/** Выдача адреса активного билда плагина участнику проекта: по маршруту на платформу. */
fun Route.activePluginBuildRoutes(evaluator: PolicyEvaluator, active: GetActivePluginBuildUseCase) {
    PreviewPluginPlatform.entries.forEach { platform ->
        route("/api/ds/${platform.routeSegment}") {
            get("/plugin") {
                // `versionId` намеренно не передаётся: активный билд не зависит от версии дизайн-системы.
                val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                    ?: return@get call.respondFailure(DsFailure.Forbidden)
                when (val result = active.execute(platform, context)) {
                    is DsResult.Success -> when (platform) {
                        PreviewPluginPlatform.COMPOSE -> call.respond(ActivePluginBuildResponse.from(result.value))
                        PreviewPluginPlatform.WEB -> call.respond(ActiveWebPluginBuildResponse.from(result.value))
                    }
                    is DsResult.Failure -> call.respondFailure(result.error)
                }
            }
        }
    }
}

private const val META_LIMIT_BYTES = 16L * 1024 * 1024
