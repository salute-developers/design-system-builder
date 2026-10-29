package com.dsbuilder.ds.tokens.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.repeatableMutation
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import com.dsbuilder.ds.tokens.application.CreateTokenValue
import com.dsbuilder.ds.tokens.application.CreateTokenValueUseCase
import com.dsbuilder.ds.tokens.application.DeleteTokenValueUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValueUseCase
import com.dsbuilder.ds.tokens.application.ListTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.UpdateTokenValue
import com.dsbuilder.ds.tokens.application.UpdateTokenValueUseCase
import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
import com.dsbuilder.ds.tokens.domain.TokenValue
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** Registers direct project-scoped token-value endpoints. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.tokenValueRoutes(
    evaluator: PolicyEvaluator,
    list: ListTokenValuesUseCase,
    get: GetTokenValueUseCase,
    create: CreateTokenValueUseCase,
    update: UpdateTokenValueUseCase,
    delete: DeleteTokenValueUseCase,
    json: Json,
) {
    route(dsRoutePath("/api/ds/token-values")) {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(TokenValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenValueUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, TokenValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateTokenValueRequest>()
            val command = request.toCommand()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val createContext = context.withIdempotentResponse<TokenValue> {
                json.encodeToString(TokenValueResponse.serializer(), TokenValueResponse.from(it))
            }
            when (val result = create.execute(createContext, command, call.request.headers["Idempotency-Key"])) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    TokenValueResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenValueUuid()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            if ("platform" in payload || "mode" in payload) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("immutable_token_value_key"))
            }
            val request = runCatching {
                json.decodeFromJsonElement(UpdateTokenValueRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand(payload)
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val mutation = call.repeatableMutation(context, payload, json = json, response = TokenValueResponse::from)
            when (val result = update.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, TokenValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenValueUuid()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val mutation = call.repeatableMutation(context, null, json = json) { _: Unit -> OkResponse() }
            when (val result = delete.execute(mutation, id)) {
                is DsResult.Success -> call.respondSuccess(result, OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

@Suppress("ComplexCondition")
private fun CreateTokenValueRequest.toCommand(): CreateTokenValue? {
    val parsedToken = tokenId?.tokenValueUuid()
    val parsedTenant = tenantId?.tokenValueUuid()
    val parsedPalette = paletteId?.tokenValueUuid()
    val parsedPlatform = platform?.let(TokenPlatform::fromWire)
    val parsedMode = mode?.let(TokenMode::fromWire)
    if (
        tokenId != null && parsedToken == null ||
        tenantId != null && parsedTenant == null ||
        paletteId != null && parsedPalette == null ||
        platform != null && parsedPlatform == null ||
        mode != null && parsedMode == null
    ) {
        return null
    }
    return CreateTokenValue(
        parsedToken,
        parsedTenant,
        parsedPalette,
        parsedPlatform,
        parsedMode,
        value ?: JsonArray(emptyList()),
    )
}

@Suppress("ComplexCondition")
private fun UpdateTokenValueRequest.toCommand(payload: JsonObject): UpdateTokenValue? {
    val parsedPalette = paletteId?.tokenValueUuid()
    val parsedPlatform = platform?.let(TokenPlatform::fromWire)
    val parsedMode = mode?.let(TokenMode::fromWire)
    if (
        "paletteId" in payload && parsedPalette == null ||
        "platform" in payload && parsedPlatform == null ||
        "mode" in payload && parsedMode == null ||
        "value" in payload && value == null
    ) {
        return null
    }
    return UpdateTokenValue(
        parsedPalette,
        "paletteId" in payload,
        parsedPlatform,
        "platform" in payload,
        parsedMode,
        "mode" in payload,
        value,
        "value" in payload,
    )
}

private fun String.tokenValueUuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
