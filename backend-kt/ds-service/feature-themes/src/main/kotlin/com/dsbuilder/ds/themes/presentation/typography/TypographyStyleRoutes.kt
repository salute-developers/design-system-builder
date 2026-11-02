package com.dsbuilder.ds.themes.presentation.typography

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import com.dsbuilder.ds.themes.application.typography.TypographyBaseRevision
import com.dsbuilder.ds.themes.application.typography.TypographyStyleUseCases
import com.dsbuilder.ds.themes.application.typography.UpdateTypographyStyle
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.typography.TypographyVariant
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.route
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** Регистрирует чтение и изменение стилей типографии `/api/ds/tenants/{tenantId}/typography-styles`. */
fun Route.typographyStyleRoutes(evaluator: PolicyEvaluator, useCases: TypographyStyleUseCases) {
    route(dsRoutePath("/api/ds/tenants/{tenantId}/typography-styles")) {
        get {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@get
            when (val result = useCases.get.execute(context, tenantId)) {
                is DsResult.Success -> call.respond(result.value.toResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{tokenId}") {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@patch
            val tokenId = uuid(call.parameters["tokenId"]) ?: return@patch call.respondFailure(TOKEN)
            val request = call.body<UpdateTypographyStyleRequest>() ?: return@patch call.respondFailure(BODY)
            if (request.baseRevisions.orEmpty().any { it.baseRevision < 0 }) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_base_revision"))
            }
            val command = request.toCommand() ?: return@patch call.respondFailure(BODY)
            when (val result = useCases.update.execute(context, tenantId, tokenId, command)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.toResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

/** Команда изменения или `null`, если начертание, токен или платформа базовой редакции не разобраны. */
@Suppress("ReturnCount")
private fun UpdateTypographyStyleRequest.toCommand(): UpdateTypographyStyle? {
    val variants = weights.orEmpty().mapKeys { (name, _) -> TypographyVariant.fromWire(name) ?: return null }
    val bases = baseRevisions.orEmpty().map { item ->
        TypographyBaseRevision(
            tokenId = uuid(item.tokenId) ?: return null,
            platform = ThemeTokenPlatform.fromWire(item.platform) ?: return null,
            baseRevision = item.baseRevision,
        )
    }
    val target = platform?.let { ThemeTokenPlatform.fromWire(it) ?: return null }
    return UpdateTypographyStyle(
        platform = target,
        size = size,
        lineHeight = lineHeight,
        letterSpacing = letterSpacing,
        weights = variants,
        fontFamily = fontFamily,
        baseRevisions = bases,
    )
}

private fun uuid(value: String?): UUID? = value?.let { runCatching { UUID.fromString(it) }.getOrNull() }

/** Контекст запроса и тема; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.tenantTarget(evaluator: PolicyEvaluator): Pair<DsRequestContext, UUID>? {
    val context = TrustedDsRequestContextMapper.map(dsTrustedHeaders(), evaluator, request.queryParameters["versionId"])
        ?: return null.also { respondFailure(DsFailure.Forbidden) }
    val tenantId = uuid(parameters["tenantId"]) ?: return null.also { respondFailure(TENANT) }
    return context to tenantId
}

/** Тело запроса или `null`, если оно не разобрано. */
private suspend inline fun <reified T : Any> ApplicationCall.body(): T? =
    runCatching { receive<T>() }
        .onFailure { if (it is CancellationException) throw it }
        .getOrNull()

// Строковый `message`: клиент показывает его пользователю.
private val TENANT = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор темы")
private val TOKEN = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор токена")
private val BODY = DsFailure.InvalidRequest("invalid_body", message = "Некорректное тело запроса")
