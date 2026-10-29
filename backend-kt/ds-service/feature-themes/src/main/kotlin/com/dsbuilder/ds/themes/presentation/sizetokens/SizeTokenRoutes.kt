package com.dsbuilder.ds.themes.presentation.sizetokens

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import com.dsbuilder.ds.themes.application.sizetokens.CreateSizeToken
import com.dsbuilder.ds.themes.application.sizetokens.CreatedSizeTokens
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenUseCases
import com.dsbuilder.ds.themes.application.sizetokens.UpdateSizeTokenValue
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput
import com.dsbuilder.ds.themes.presentation.repeatableThemeMutation
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/**
 * Регистрирует операции раздела «Отступы, радиусы и тени» `/api/ds/tenants/{tenantId}/size-tokens`. Чтение
 * принимает `versionId`; мутации пишут предметные редакции и отдают их в `X-DS-Mutation-Metadata`.
 */
fun Route.sizeTokenRoutes(evaluator: PolicyEvaluator, useCases: SizeTokenUseCases) {
    route(dsRoutePath("/api/ds/tenants/{tenantId}/size-tokens")) {
        sizeTokenReadRoute(evaluator, useCases)
        sizeTokenCreateRoute(evaluator, useCases)
        sizeTokenUpdateRoute(evaluator, useCases)
        sizeTokenDeleteRoute(evaluator, useCases)
    }
}

private fun Route.sizeTokenReadRoute(evaluator: PolicyEvaluator, useCases: SizeTokenUseCases) {
    get {
        val (context, tenantId) = call.tenantTarget(evaluator) ?: return@get
        when (val result = useCases.get.execute(context, tenantId)) {
            is DsResult.Success -> call.respondSuccess(result, result.value.toResponse())
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.sizeTokenCreateRoute(evaluator: PolicyEvaluator, useCases: SizeTokenUseCases) {
    post {
        val (context, tenantId) = call.tenantTarget(evaluator) ?: return@post
        val body = call.body<CreateSizeTokenRequest>() ?: return@post call.respondFailure(BODY)
        val command = body.toCommand() ?: return@post call.respondFailure(BODY)
        val repeatable = call.repeatableThemeMutation(context, body, HttpStatusCode.Created.value) {
                value: CreatedSizeTokens ->
            value.toResponse()
        }
        when (val result = useCases.create.execute(repeatable, tenantId, command)) {
            is DsResult.Success -> call.respondSuccess(result, HttpStatusCode.Created, result.value.toResponse())
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.sizeTokenUpdateRoute(evaluator: PolicyEvaluator, useCases: SizeTokenUseCases) {
    put("/{tokenId}/value") {
        val (context, tenantId) = call.tenantTarget(evaluator) ?: return@put
        val tokenId = call.tokenId() ?: return@put
        val body = call.body<UpdateSizeTokenValueRequest>() ?: return@put call.respondFailure(BODY)
        val baseRevisions = body.baseRevisions.orEmpty().entries.associate { (platform, revision) ->
            (ThemeTokenPlatform.fromWire(platform) ?: return@put call.respondFailure(BASE_REVISION)) to revision
        }
        val command = UpdateSizeTokenValue(
            SizeValueInput(body.valuePx, body.layers, body.fallbackElevation, body.platforms),
            baseRevisions,
        )
        when (val result = useCases.updateValue.execute(context, tenantId, tokenId, command)) {
            is DsResult.Success -> call.respondSuccess(
                result,
                UpdateSizeTokenValueResponse(
                    kind = result.value.token.kind.wireValue,
                    token = result.value.token.toJson(),
                    values = result.value.values.map { it.toDto() },
                ),
            )
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.sizeTokenDeleteRoute(evaluator: PolicyEvaluator, useCases: SizeTokenUseCases) {
    delete("/{tokenId}") {
        val (context, tenantId) = call.tenantTarget(evaluator) ?: return@delete
        val tokenId = call.tokenId() ?: return@delete
        when (val result = useCases.delete.execute(context, tenantId, tokenId)) {
            is DsResult.Success -> call.respondSuccess(
                result,
                DeleteSizeTokenResponse(result.value.map(UUID::toString)),
            )
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

/** Команда создания или `null`, если раздел не разобран. */
private fun CreateSizeTokenRequest.toCommand(): CreateSizeToken? = SizeTokenKind.fromWire(kind)?.let { tokenKind ->
    CreateSizeToken(
        kind = tokenKind,
        name = name,
        value = SizeValueInput(valuePx = valuePx, layers = layers, variants = variants),
    )
}

private fun CreatedSizeTokens.toResponse() = CreateSizeTokenResponse(kind.wireValue, created.map { it.toJson() })

private fun uuid(value: String?): UUID? = value?.let { runCatching { UUID.fromString(it) }.getOrNull() }

/** Контекст запроса с `versionId` и тема; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.tenantTarget(evaluator: PolicyEvaluator): Pair<DsRequestContext, UUID>? {
    val context = TrustedDsRequestContextMapper.map(dsTrustedHeaders(), evaluator, request.queryParameters["versionId"])
        ?: return null.also { respondFailure(DsFailure.Forbidden) }
    val tenantId = uuid(parameters["tenantId"]) ?: return null.also { respondFailure(TENANT) }
    return context to tenantId
}

/** Токен из пути; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.tokenId(): UUID? =
    uuid(parameters["tokenId"]) ?: null.also { respondFailure(TOKEN) }

/** Тело запроса или `null`, если оно не разобрано. */
private suspend inline fun <reified T : Any> ApplicationCall.body(): T? =
    runCatching { receive<T>() }
        .onFailure { if (it is CancellationException) throw it }
        .getOrNull()

// Строковый `message`: клиент показывает его пользователю, `error` у 400 — объект проверки полей.
private val TENANT = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор темы")
private val TOKEN = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор токена")
private val BODY = DsFailure.InvalidRequest("invalid_body", message = "Некорректное тело запроса")
private val BASE_REVISION = DsFailure.InvalidRequest(
    "invalid_base_revision",
    message = "Базовые редакции задаются для платформ web, ios и android",
)
