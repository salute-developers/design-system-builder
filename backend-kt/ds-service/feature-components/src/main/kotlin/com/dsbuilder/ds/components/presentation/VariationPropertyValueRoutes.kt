package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.DeleteVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.GetVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesByAppearanceUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesByStyleUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesUseCase
import com.dsbuilder.ds.components.application.PropertyValueRepository
import com.dsbuilder.ds.components.application.UpdateVariationPropertyValueUseCase
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

/** Registers variation property-value routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.variationPropertyValueRoutes(
    evaluator: PolicyEvaluator,
    list: ListVariationPropertyValuesUseCase,
    get: GetVariationPropertyValueUseCase,
    listByStyle: ListVariationPropertyValuesByStyleUseCase,
    listByAppearance: ListVariationPropertyValuesByAppearanceUseCase,
    create: CreateVariationPropertyValueUseCase,
    update: UpdateVariationPropertyValueUseCase,
    delete: DeleteVariationPropertyValueUseCase,
    json: Json,
) {
    route("/api/ds/variation-property-values") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(VariationPropertyValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(VariationPropertyValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-style/{styleId}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val styleId = call.parameters["styleId"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_style_id"))
            when (val result = listByStyle.execute(context, styleId)) {
                is DsResult.Success -> call.respond(result.value.map(VariationPropertyValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-appearance/{appearanceId}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val appearanceId = call.parameters["appearanceId"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_appearance_id"))
            when (val result = listByAppearance.execute(context, appearanceId)) {
                is DsResult.Success -> call.respond(result.value.map(VariationPropertyValueResponse::from))
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
                json.decodeFromJsonElement(CreateVariationPropertyValueRequest.serializer(), payload)
            }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    VariationPropertyValueResponse.from(result.value),
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
                is DsResult.Success -> call.respond(VariationPropertyValueResponse.from(result.value))
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
private fun CreateVariationPropertyValueRequest.toCommand(): PropertyValueRepository.VariationCreate? {
    val propertyUuid = propertyId.toUuidOrNull() ?: return null
    val styleUuid = styleId.toUuidOrNull() ?: return null
    val appearanceUuid = appearanceId.toUuidOrNull() ?: return null
    val tokenUuid = tokenId?.toUuidOrNull()
    val stateSetUuid = stateSetId.toUuidOrNull() ?: return null
    if (tokenId != null && tokenUuid == null) return null
    return PropertyValueRepository.VariationCreate(
        propertyUuid,
        styleUuid,
        appearanceUuid,
        tokenUuid,
        value?.trim(),
        alpha?.trim(),
        adjustment?.trim(),
        stateSetUuid,
    )
}

@Suppress("ComplexCondition")
internal fun UpdatePropertyValueRequest.toCommand(payload: JsonObject): PropertyValueRepository.ValueUpdate? {
    val tokenUuid = tokenId?.toUuidOrNull()
    val stateSetUuid = stateSetId?.toUuidOrNull()
    if (tokenId != null && tokenUuid == null || stateSetId != null && stateSetUuid == null) return null
    return PropertyValueRepository.ValueUpdate(
        tokenUuid,
        "tokenId" in payload,
        value?.trim(),
        "value" in payload,
        alpha?.trim(),
        "alpha" in payload,
        adjustment?.trim(),
        "adjustment" in payload,
        stateSetUuid,
    )
}
