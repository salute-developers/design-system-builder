package com.dsbuilder.ds.themes.presentation.tokengroups

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenMutation
import com.dsbuilder.ds.themes.application.tokengroups.CreateTokenGroup
import com.dsbuilder.ds.themes.application.tokengroups.TokenGroupUseCases
import com.dsbuilder.ds.themes.application.tokengroups.UpdateTokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** Регистрирует список групп токенов дизайн-системы и операции над ними в теме. */
fun Route.tokenGroupRoutes(evaluator: PolicyEvaluator, useCases: TokenGroupUseCases) {
    get("/api/ds/design-systems/{designSystemId}/token-groups") {
        val context = call.context(evaluator) ?: return@get
        val designSystemId = uuid(call.parameters["designSystemId"])
            ?: return@get call.respondFailure(invalidId("дизайн-системы"))
        val kind = call.groupKind() ?: return@get
        when (val result = useCases.list.execute(context, designSystemId, kind)) {
            is DsResult.Success -> call.respond(result.value.map(TokenGroupDto::from))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
    route("/api/ds/tenants/{tenantId}/token-groups") {
        post {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@post
            val command = call.body<CreateTokenGroupRequest>()?.toCommand() ?: return@post call.respondFailure(BODY)
            call.respondGroup(useCases.create.execute(context, tenantId, command), HttpStatusCode.Created)
        }
        patch("/{groupId}") {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@patch
            val groupId = call.groupId() ?: return@patch
            val command = call.body<UpdateTokenGroupRequest>()?.toCommand() ?: return@patch call.respondFailure(BODY)
            call.respondGroup(useCases.update.execute(context, tenantId, groupId, command), HttpStatusCode.OK)
        }
        delete("/{groupId}") {
            val (context, tenantId) = call.tenantTarget(evaluator) ?: return@delete
            val groupId = call.groupId() ?: return@delete
            val body = call.body<DeleteTokenGroupRequest>() ?: return@delete call.respondFailure(BODY)
            call.respondRevision(useCases.delete.execute(context, tenantId, groupId, body.editRevision))
        }
    }
}

/** Команда создания или `null`, если вид или родитель не разобраны. */
private fun CreateTokenGroupRequest.toCommand(): CreateTokenGroup? {
    val groupKind = TokenGroupKind.fromWire(kind) ?: return null
    val parent = parentId?.let { uuid(it) ?: return null }
    return CreateTokenGroup(editRevision, groupKind, parent, label, position)
}

/** Команда изменения или `null`, если родитель не разобран. */
private fun UpdateTokenGroupRequest.toCommand(): UpdateTokenGroup? {
    val parent = parentId?.let { uuid(it) ?: return null }
    return UpdateTokenGroup(editRevision, label, parent, position)
}

private fun uuid(value: String?): UUID? = value?.let { runCatching { UUID.fromString(it) }.getOrNull() }

/** Контекст запроса; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.context(evaluator: PolicyEvaluator): DsRequestContext? =
    TrustedDsRequestContextMapper.map(request.headers, evaluator) ?: null.also { respondFailure(DsFailure.Forbidden) }

/** Контекст запроса и тема; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.tenantTarget(evaluator: PolicyEvaluator): Pair<DsRequestContext, UUID>? {
    val context = context(evaluator) ?: return null
    val tenantId = uuid(parameters["tenantId"]) ?: return null.also { respondFailure(invalidId("темы")) }
    return context to tenantId
}

/** Вид групп из запроса (по умолчанию цветовые); `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.groupKind(): TokenGroupKind? =
    TokenGroupKind.fromWire(request.queryParameters["kind"] ?: TokenGroupKind.COLOR.wireValue)
        ?: null.also {
            respondFailure(DsFailure.InvalidRequest("invalid_kind", message = "Неизвестный вид групп"))
        }

/** Группа из пути; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.groupId(): UUID? =
    uuid(parameters["groupId"]) ?: null.also { respondFailure(invalidId("группы")) }

/** Тело запроса или `null`, если оно не разобрано. */
private suspend inline fun <reified T : Any> ApplicationCall.body(): T? =
    runCatching { receive<T>() }
        .onFailure { if (it is CancellationException) throw it }
        .getOrNull()

private suspend fun ApplicationCall.respondGroup(
    result: DsResult<ColorTokenMutation<TokenGroup>>,
    status: HttpStatusCode,
) =
    when (result) {
        is DsResult.Success ->
            respond(
                status,
                TokenGroupMutationResponse(result.value.editRevision, TokenGroupDto.from(result.value.value)),
            )
        is DsResult.Failure -> respondFailure(result.error)
    }

private suspend fun ApplicationCall.respondRevision(result: DsResult<Int>) = when (result) {
    is DsResult.Success -> respond(TokenGroupRevisionResponse(result.value))
    is DsResult.Failure -> respondFailure(result.error)
}

// Строковый `message`: клиент показывает его пользователю, `error` у 400 — объект проверки полей.
private fun invalidId(subject: String) =
    DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор $subject")
private val BODY = DsFailure.InvalidRequest("invalid_body", message = "Некорректное тело запроса")
