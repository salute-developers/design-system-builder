package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.GetIconCatalogUseCase
import com.dsbuilder.ds.components.application.PublishIconCatalogUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.ErrorResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.respondFailure
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json

private val lenientJson = Json { ignoreUnknownKeys = true }

/** Максимальный размер тела загрузки каталога иконок. */
const val ICON_CATALOG_UPLOAD_LIMIT_BYTES: Int = 32 * 1024 * 1024

/**
 * Загрузка каталога иконок: JSON-манифест с SVG. Параметр `dryRun` по умолчанию `true`, `allowRemovingUsed`
 * разрешает удаление используемых иконок. Роль проверяется до чтения тела.
 */
fun Route.iconCatalogPublishRoutes(evaluator: PolicyEvaluator, publish: PublishIconCatalogUseCase) {
    route(dsRoutePath("/api/admin/icons")) {
        post("/catalog") {
            val context = TrustedDsRequestContextMapper.map(call.dsTrustedHeaders(), evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            if (!context.principal.globalAdmin && !context.principal.composePreviewPublisher) {
                return@post call.respondFailure(DsFailure.Forbidden)
            }
            val query = call.request.queryParameters
            val dryRun = query["dryRun"]?.toBooleanStrictOrNull() ?: true
            val allowRemovingUsed = query["allowRemovingUsed"]?.toBooleanStrictOrNull() ?: false
            val body = call.receiveAtMost(ICON_CATALOG_UPLOAD_LIMIT_BYTES)
                ?: return@post call.respond(HttpStatusCode.PayloadTooLarge, ErrorResponse("Payload too large"))
            val command = runCatching {
                lenientJson.decodeFromString<PublishIconCatalogRequest>(body.toString(Charsets.UTF_8))
                    .toCommand(dryRun, allowRemovingUsed)
            }.getOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = publish.execute(context, command)) {
                is DsResult.Success -> call.respond(PublishIconCatalogResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

/** Выдача активного каталога участнику проекта с `ETag` по идентификатору загрузки. */
fun Route.iconCatalogReadRoutes(evaluator: PolicyEvaluator, get: GetIconCatalogUseCase) {
    route(dsRoutePath("/api/design-systems/catalog")) {
        get("/icons") {
            val context = TrustedDsRequestContextMapper.map(call.dsTrustedHeaders(), evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = get.execute(context)) {
                is DsResult.Success -> {
                    val etag = "\"${result.value.load?.loadId?.value ?: "empty"}\""
                    call.response.header(HttpHeaders.ETag, etag)
                    call.response.header(HttpHeaders.CacheControl, "private, no-cache")
                    if (call.request.headers[HttpHeaders.IfNoneMatch] == etag) {
                        call.respond(HttpStatusCode.NotModified)
                    } else {
                        call.respond(IconCatalogResponse.from(result.value))
                    }
                }
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
