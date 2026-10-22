package com.dsbuilder.ds.themes.presentation.colortokens

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenMutation
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenUseCases
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenValue
import com.dsbuilder.ds.themes.application.colortokens.CreateColorToken
import com.dsbuilder.ds.themes.application.colortokens.MoveColorToken
import com.dsbuilder.ds.themes.application.colortokens.StoredColorTokenFamily
import com.dsbuilder.ds.themes.application.colortokens.UpdateColorTokenValues
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.presentation.repeatableThemeMutation
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** Регистрирует операции над цветовым токеном `/api/ds/tenants/{tenantId}/color-tokens`. */
fun Route.colorTokenRoutes(evaluator: PolicyEvaluator, useCases: ColorTokenUseCases) {
    route("/api/ds/tenants/{tenantId}/color-tokens") {
        post {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@post
            val command = call.body<CreateColorTokenRequest>()?.toCommand() ?: return@post call.respondFailure(BODY)
            call.respondFamily(
                useCases.create.execute(call.familyContext(context, command, 201), tenantId, command),
                HttpStatusCode.Created,
            )
        }
        put("/{tokenId}/values") {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@put
            val tokenId = call.tokenId() ?: return@put
            val command = call.body<UpdateColorTokenValuesRequest>()?.toCommand()
                ?: return@put call.respondFailure(BODY)
            call.respondRevision(
                useCases.updateValues.execute(call.revisionContext(context, command), tenantId, tokenId, command),
            )
        }
        post("/{tokenId}/move") {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@post
            val tokenId = call.tokenId() ?: return@post
            val command = call.body<MoveColorTokenRequest>()?.toCommand() ?: return@post call.respondFailure(BODY)
            call.respondFamily(
                useCases.move.execute(call.familyContext(context, command), tenantId, tokenId, command),
                HttpStatusCode.OK,
            )
        }
        delete("/{tokenId}") {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@delete
            val tokenId = call.tokenId() ?: return@delete
            val body = call.body<DeleteColorTokenRequest>() ?: return@delete call.respondFailure(BODY)
            call.respondRevision(
                useCases.delete.execute(call.revisionContext(context, body), tenantId, tokenId, body.editRevision),
            )
        }
    }
}

/** Команда создания или `null`, если тип, платформа, режим или идентификатор не разобраны. */
@Suppress("ReturnCount")
private fun CreateColorTokenRequest.toCommand(): CreateColorToken? {
    val tokenType = ThemeTokenType.fromWire(type)?.takeIf { it in ColorTokenFamily.TYPES } ?: return null
    val values = members.associate { member -> member.name to (member.values.toValues() ?: return null) }
    if (values.size != members.size) return null
    val tokenGroupId = groupId?.let { uuid(it) ?: return null }
    return CreateColorToken(
        editRevision = editRevision,
        family = ColorTokenFamily(tokenType, group, name),
        displayName = displayName,
        description = description,
        paletteGroupId = paletteGroupId,
        members = values,
        groupId = tokenGroupId,
        position = position,
    )
}

/** Команда переноса или `null`, если идентификатор группы не разобран. */
private fun MoveColorTokenRequest.toCommand(): MoveColorToken? =
    uuid(groupId)?.let { MoveColorToken(editRevision, it, position, name) }

/** Команда изменения или `null`, если идентификатор, платформа или режим не разобраны. */
private fun UpdateColorTokenValuesRequest.toCommand(): UpdateColorTokenValues? {
    val values = members.associate { member ->
        (uuid(member.tokenId) ?: return null) to (member.values.toValues() ?: return null)
    }
    return if (values.size == members.size) UpdateColorTokenValues(editRevision, values) else null
}

private fun List<ColorTokenValueItem>.toValues(): List<ColorTokenValue>? = map { item ->
    if (item.baseRevision != null && item.baseRevision < 0) return null
    ColorTokenValue(
        platform = ThemeTokenPlatform.fromWire(item.platform) ?: return null,
        mode = ThemeTokenMode.fromWire(item.mode) ?: return null,
        paletteId = item.paletteId?.let { uuid(it) ?: return null },
        value = item.value,
        baseRevision = item.baseRevision,
    )
}

private fun uuid(value: String?): UUID? = value?.let { runCatching { UUID.fromString(it) }.getOrNull() }

/** Контекст запроса и тема; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.tenantTarget(evaluator: PolicyEvaluator): Pair<DsRequestContext, UUID>? {
    val context = TrustedDsRequestContextMapper.map(request.headers, evaluator, request.queryParameters["versionId"])
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

private suspend fun ApplicationCall.respondFamily(
    result: DsResult<ColorTokenMutation<StoredColorTokenFamily>>,
    status: HttpStatusCode,
) = when (result) {
    is DsResult.Success -> respondSuccess(
        result,
        status,
        ColorTokenMutationResponse(0, ColorTokenFamilyDto.from(result.value.value)),
    )
    is DsResult.Failure -> respondFailure(result.error)
}

private suspend fun ApplicationCall.respondRevision(result: DsResult<Int>) = when (result) {
    is DsResult.Success -> respondSuccess(result, ColorTokenRevisionResponse(result.value))
    is DsResult.Failure -> respondFailure(result.error)
}

// Строковый `message`: клиент показывает его пользователю, `error` у 400 — объект проверки полей.
private val TENANT = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор темы")
private val TOKEN = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор токена")
private val BODY = DsFailure.InvalidRequest("invalid_body", message = "Некорректное тело запроса")

private fun ApplicationCall.familyContext(context: DsRequestContext, body: Any, status: Int = 200) =
    repeatableThemeMutation(context, body, status) { value: ColorTokenMutation<StoredColorTokenFamily> ->
        ColorTokenMutationResponse(0, ColorTokenFamilyDto.from(value.value))
    }

private fun ApplicationCall.revisionContext(context: DsRequestContext, body: Any) =
    repeatableThemeMutation(context, body) { value: Int -> ColorTokenRevisionResponse(value) }
