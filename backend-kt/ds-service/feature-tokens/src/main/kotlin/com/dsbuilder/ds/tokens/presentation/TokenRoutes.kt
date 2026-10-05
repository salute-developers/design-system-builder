package com.dsbuilder.ds.tokens.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.tokens.application.CreateToken
import com.dsbuilder.ds.tokens.application.CreateTokenUseCase
import com.dsbuilder.ds.tokens.application.DeleteTokenUseCase
import com.dsbuilder.ds.tokens.application.GetTokenUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.ListTokensUseCase
import com.dsbuilder.ds.tokens.application.TokenValueFilter
import com.dsbuilder.ds.tokens.application.UpdateToken
import com.dsbuilder.ds.tokens.application.UpdateTokenUseCase
import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
import com.dsbuilder.ds.tokens.domain.TokenType
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** Registers project-scoped token endpoints. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.tokenRoutes(
    evaluator: PolicyEvaluator,
    list: ListTokensUseCase,
    get: GetTokenUseCase,
    create: CreateTokenUseCase,
    update: UpdateTokenUseCase,
    delete: DeleteTokenUseCase,
    getValues: GetTokenValuesUseCase,
    json: Json,
) {
    route("/api/ds/tokens") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(TokenResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(TokenResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/values") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val tenantId = call.request.queryParameters["tenantId"]?.tokenUuid()
            val platformWire = call.request.queryParameters["platform"]
            val modeWire = call.request.queryParameters["mode"]
            val platform = platformWire?.let(TokenPlatform::fromWire)
            val mode = modeWire?.let(TokenMode::fromWire)
            val invalidQuery = listOf(
                call.request.queryParameters["tenantId"] != null && tenantId == null,
                platformWire != null && platform == null,
                modeWire != null && mode == null,
            ).any { it }
            if (invalidQuery) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_query"))
            }
            val filter = TokenValueFilter(tenantId, platform, mode)
            when (val result = getValues.execute(context, id, filter)) {
                is DsResult.Success -> call.respond(result.value.map(TokenValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateTokenRequest>()
            val designSystemId = request.designSystemId?.tokenUuid()
            val type = request.type?.let(TokenType::fromWire)
            val invalidBody = listOf(
                !request.valid(),
                request.designSystemId != null && designSystemId == null,
                request.type != null && type == null,
            ).any { it }
            if (invalidBody) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = CreateToken(
                designSystemId,
                request.name.trim(),
                type,
                request.displayName?.trim(),
                request.description?.trim(),
                request.enabled,
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(HttpStatusCode.Created, TokenResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenUuid()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            val request = runCatching {
                json.decodeFromJsonElement(UpdateTokenRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val type = request.type?.let(TokenType::fromWire)
            if (!request.valid(payload) || request.type != null && type == null) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = UpdateToken(
                request.name?.trim(),
                "name" in payload,
                type,
                "type" in payload,
                request.displayName?.trim(),
                "displayName" in payload,
                request.description?.trim(),
                "description" in payload,
                request.enabled,
                "enabled" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(TokenResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenUuid()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = delete.execute(context, id)) {
                is DsResult.Success -> call.respond(OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

@Suppress("ComplexCondition")
private fun CreateTokenRequest.valid() = name.trim().isNotEmpty() && name.trim().length <= 255 &&
    (displayName?.trim()?.length ?: 0) <= 255 &&
    (description?.trim()?.length ?: 0) <= 1000

@Suppress("ComplexCondition")
private fun UpdateTokenRequest.valid(payload: JsonObject) =
    ("name" !in payload || name != null && name.trim().isNotEmpty() && name.trim().length <= 255) &&
        ("type" !in payload || type != null) &&
        ("displayName" !in payload || displayName != null && displayName.trim().length <= 255) &&
        ("description" !in payload || description != null && description.trim().length <= 1000) &&
        ("enabled" !in payload || enabled != null)

private fun String.tokenUuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
