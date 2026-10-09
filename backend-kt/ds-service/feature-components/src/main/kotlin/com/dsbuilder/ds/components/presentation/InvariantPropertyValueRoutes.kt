package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.DeleteInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.GetInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.ListInvariantPropertyValuesByComponentAndDesignSystemUseCase
import com.dsbuilder.ds.components.application.ListInvariantPropertyValuesUseCase
import com.dsbuilder.ds.components.application.PropertyValueRepository
import com.dsbuilder.ds.components.application.UpdateInvariantPropertyValueUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
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

/** Registers invariant property-value routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.invariantPropertyValueRoutes(
    evaluator: PolicyEvaluator,
    list: ListInvariantPropertyValuesUseCase,
    get: GetInvariantPropertyValueUseCase,
    listByOwner: ListInvariantPropertyValuesByComponentAndDesignSystemUseCase,
    create: CreateInvariantPropertyValueUseCase,
    update: UpdateInvariantPropertyValueUseCase,
    delete: DeleteInvariantPropertyValueUseCase,
    json: Json,
) {
    route("/api/ds/invariant-property-values") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(InvariantPropertyValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(InvariantPropertyValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-component/{componentId}/by-design-system/{designSystemId}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val componentId = call.parameters["componentId"].toUuidOrNull()
            val designSystemId = call.parameters["designSystemId"].toUuidOrNull()
            if (componentId == null || designSystemId == null) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            }
            when (val result = listByOwner.execute(context, componentId, designSystemId)) {
                is DsResult.Success -> call.respond(result.value.map(InvariantPropertyValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val payload = call.receive<JsonObject>()
            if (payload.hasInvalidNull("tokenId", "value", "alpha", "adjustment")) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val request = runCatching {
                json.decodeFromJsonElement(CreateInvariantPropertyValueRequest.serializer(), payload)
            }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    InvariantPropertyValueResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            if (payload.hasInvalidNull("tokenId", "value", "alpha", "adjustment", "stateSetId")) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val request = runCatching {
                json.decodeFromJsonElement(UpdatePropertyValueRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand(payload)
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(InvariantPropertyValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = delete.execute(context, id)) {
                is DsResult.Success -> call.respond(OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

@Suppress("ReturnCount")
private fun CreateInvariantPropertyValueRequest.toCommand(): PropertyValueRepository.InvariantCreate? {
    val propertyUuid = propertyId.toUuidOrNull() ?: return null
    val designSystemUuid = designSystemId.toUuidOrNull() ?: return null
    val componentUuid = componentId.toUuidOrNull() ?: return null
    val appearanceUuid = appearanceId.toUuidOrNull() ?: return null
    val tokenUuid = tokenId?.toUuidOrNull()
    val stateSetUuid = stateSetId.toUuidOrNull() ?: return null
    if (tokenId != null && tokenUuid == null) return null
    return PropertyValueRepository.InvariantCreate(
        propertyUuid,
        designSystemUuid,
        componentUuid,
        appearanceUuid,
        tokenUuid,
        value?.trim(),
        alpha?.trim(),
        adjustment?.trim(),
        stateSetUuid,
    )
}
