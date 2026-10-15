package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateStateUseCase
import com.dsbuilder.ds.components.application.GetStateImpactUseCase
import com.dsbuilder.ds.components.application.GetStateUseCase
import com.dsbuilder.ds.components.application.ListStatesUseCase
import com.dsbuilder.ds.components.application.StateRepository
import com.dsbuilder.ds.components.application.UpdateStateUseCase
import com.dsbuilder.ds.components.domain.ComponentState
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/** Registers state dictionary routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.stateRoutes(
    evaluator: PolicyEvaluator,
    list: ListStatesUseCase,
    get: GetStateUseCase,
    impact: GetStateImpactUseCase,
    create: CreateStateUseCase,
    update: UpdateStateUseCase,
    json: Json,
) {
    route("/api/ds/states") {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val rawComponentId = call.request.queryParameters["componentId"]
            val componentId = when (rawComponentId) {
                null, "null" -> null
                else -> rawComponentId.toUuidOrNull()
                    ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_component_id"))
            }
            when (val result = list.execute(context, componentId, rawComponentId != null)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(ComponentStateResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/impact") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = impact.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, StateImpactResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentStateResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val payload = call.receive<JsonObject>()
            if (payload.hasInvalidNull("description")) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val request = runCatching { json.decodeFromJsonElement(CreateStateRequest.serializer(), payload) }
                .getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val componentId = request.componentId?.toUuidOrNull()
            if (request.componentId != null && componentId == null || !request.name.validName() ||
                !request.description.validDescription()
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = StateRepository.Create(componentId, request.name.trim(), request.description?.trim())
            when (
                val result = create.execute(
                    context.withIdempotentResponse { value: ComponentState ->
                        json.encodeToString(ComponentStateResponse.from(value))
                    },
                    command,
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    ComponentStateResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            if (payload.hasInvalidNull("name", "description")) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val request = runCatching { json.decodeFromJsonElement(UpdateStateRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (request.name != null && !request.name.validName() || !request.description.validDescription()) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = StateRepository.Update(
                request.name?.trim(),
                request.description?.trim(),
                "description" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentStateResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
