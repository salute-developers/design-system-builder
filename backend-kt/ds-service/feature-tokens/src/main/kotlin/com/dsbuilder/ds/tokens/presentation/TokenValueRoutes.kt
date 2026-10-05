package com.dsbuilder.ds.tokens.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.tokens.application.CreateTokenValue
import com.dsbuilder.ds.tokens.application.CreateTokenValueUseCase
import com.dsbuilder.ds.tokens.application.DeleteTokenValueUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValueUseCase
import com.dsbuilder.ds.tokens.application.ListTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.UpdateTokenValue
import com.dsbuilder.ds.tokens.application.UpdateTokenValueUseCase
import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** Registers direct project-scoped token-value endpoints. */
@Suppress("CyclomaticComplexMethod", "LongParameterList")
fun Route.tokenValueRoutes(
    evaluator: PolicyEvaluator,
    list: ListTokenValuesUseCase,
    get: GetTokenValueUseCase,
    create: CreateTokenValueUseCase,
    update: UpdateTokenValueUseCase,
    delete: DeleteTokenValueUseCase,
    json: Json,
) {
    route("/api/ds/token-values") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(TokenValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenValueUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(TokenValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateTokenValueRequest>()
            val command = request.toCommand()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(HttpStatusCode.Created, TokenValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenValueUuid()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            val request = runCatching {
                json.decodeFromJsonElement(UpdateTokenValueRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand(payload)
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(TokenValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.tokenValueUuid()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = delete.execute(context, id)) {
                is DsResult.Success -> call.respond(OkResponse())
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
