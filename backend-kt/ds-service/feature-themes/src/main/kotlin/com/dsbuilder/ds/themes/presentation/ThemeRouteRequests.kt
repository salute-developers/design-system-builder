package com.dsbuilder.ds.themes.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.respondFailure
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** Разбирает UUID параметра запроса без исключения на неверном формате. */
internal fun themeUuid(value: String?): UUID? = value?.let { runCatching { UUID.fromString(it) }.getOrNull() }

/** Получает контекст и тему; при отказе отправляет прежний ответ соответствующего маршрута. */
internal suspend fun ApplicationCall.themeTenantTarget(evaluator: PolicyEvaluator): Pair<DsRequestContext, UUID>? {
    val context = TrustedDsRequestContextMapper.map(dsTrustedHeaders(), evaluator, request.queryParameters["versionId"])
        ?: return null.also { respondFailure(DsFailure.Forbidden) }
    val tenantId = themeUuid(parameters["tenantId"]) ?: return null.also { respondFailure(INVALID_TENANT) }
    return context to tenantId
}

/** Читает тело запроса либо возвращает null; отмена корутины всегда передаётся вызывающему коду. */
internal suspend inline fun <reified T : Any> ApplicationCall.themeRequestBody(): T? =
    runCatching { receive<T>() }
        .onFailure { if (it is CancellationException) throw it }
        .getOrNull()

private val INVALID_TENANT = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор темы")
