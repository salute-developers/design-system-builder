package com.dsbuilder.ds.themes.presentation.sizetokens

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.themes.application.sizetokens.CreateSizeToken
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenUseCases
import com.dsbuilder.ds.themes.application.sizetokens.UpdateSizeTokenValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** Регистрирует операции раздела «Отступы, радиусы и тени» `/api/ds/tenants/{tenantId}/size-tokens`. */
fun Route.sizeTokenRoutes(evaluator: PolicyEvaluator, useCases: SizeTokenUseCases) {
    route("/api/ds/tenants/{tenantId}/size-tokens") {
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
            is DsResult.Success -> call.respond(result.value.toResponse())
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.sizeTokenCreateRoute(evaluator: PolicyEvaluator, useCases: SizeTokenUseCases) {
    post {
        val (context, tenantId) = call.tenantTarget(evaluator) ?: return@post
        val command = call.body<CreateSizeTokenRequest>()?.toCommand() ?: return@post call.respondFailure(BODY)
        when (val result = useCases.create.execute(context, tenantId, command)) {
            is DsResult.Success -> call.respond(
                HttpStatusCode.Created,
                CreateSizeTokenResponse(
                    editRevision = result.value.editRevision,
                    kind = result.value.value.kind.wireValue,
                    created = result.value.value.created.map { it.toJson() },
                ),
            )
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.sizeTokenUpdateRoute(evaluator: PolicyEvaluator, useCases: SizeTokenUseCases) {
    put("/{tokenId}/value") {
        val (context, tenantId) = call.tenantTarget(evaluator) ?: return@put
        val tokenId = call.tokenId() ?: return@put
        val body = call.body<UpdateSizeTokenValueRequest>() ?: return@put call.respondFailure(BODY)
        val command = UpdateSizeTokenValue(
            body.editRevision,
            SizeValueInput(body.valuePx, body.layers, body.fallbackElevation, body.platforms),
        )
        when (val result = useCases.updateValue.execute(context, tenantId, tokenId, command)) {
            is DsResult.Success -> call.respond(
                UpdateSizeTokenValueResponse(
                    editRevision = result.value.editRevision,
                    kind = result.value.value.token.kind.wireValue,
                    token = result.value.value.token.toJson(),
                    values = result.value.value.values.map { it.toDto() },
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
        val body = call.body<DeleteSizeTokenRequest>() ?: return@delete call.respondFailure(BODY)
        when (val result = useCases.delete.execute(context, tenantId, tokenId, body.editRevision)) {
            is DsResult.Success -> call.respond(
                DeleteSizeTokenResponse(result.value.editRevision, result.value.value.map(UUID::toString)),
            )
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

/** Команда создания или `null`, если раздел не разобран. */
private fun CreateSizeTokenRequest.toCommand(): CreateSizeToken? = SizeTokenKind.fromWire(kind)?.let { tokenKind ->
    CreateSizeToken(
        editRevision = editRevision,
        kind = tokenKind,
        name = name,
        value = SizeValueInput(valuePx = valuePx, layers = layers, variants = variants),
    )
}

private fun uuid(value: String?): UUID? = value?.let { runCatching { UUID.fromString(it) }.getOrNull() }

/** Контекст запроса и тема; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.tenantTarget(evaluator: PolicyEvaluator): Pair<DsRequestContext, UUID>? {
    val context = TrustedDsRequestContextMapper.map(request.headers, evaluator)
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
