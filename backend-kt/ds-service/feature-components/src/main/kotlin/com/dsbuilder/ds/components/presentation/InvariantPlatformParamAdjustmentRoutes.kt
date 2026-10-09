package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.CreateInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.DeleteInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.GetInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.ListInvariantPlatformParamAdjustmentsUseCase
import com.dsbuilder.ds.components.application.UpdateInvariantPlatformParamAdjustmentUseCase
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

/** Registers invariant platform-param adjustment CRUD routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.invariantPlatformParamAdjustmentRoutes(
    evaluator: PolicyEvaluator,
    list: ListInvariantPlatformParamAdjustmentsUseCase,
    get: GetInvariantPlatformParamAdjustmentUseCase,
    create: CreateInvariantPlatformParamAdjustmentUseCase,
    update: UpdateInvariantPlatformParamAdjustmentUseCase,
    delete: DeleteInvariantPlatformParamAdjustmentUseCase,
    json: Json,
) {
    route("/api/ds/invariant-platform-param-adjustments") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(InvariantPlatformParamAdjustmentResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(InvariantPlatformParamAdjustmentResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val payload = call.receive<JsonObject>()
            val request = runCatching {
                json.decodeFromJsonElement(CreateInvariantPlatformParamAdjustmentRequest.serializer(), payload)
            }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val ipvId = request.ipvId.toUuidOrNull()
            val platformParamId = request.platformParamId.toUuidOrNull()
            if (ipvId == null || platformParamId == null || payload.hasInvalidNull("value", "template")) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.InvariantAdjustmentCreate(
                ipvId,
                platformParamId,
                request.value?.trim(),
                request.template?.trim(),
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    InvariantPlatformParamAdjustmentResponse.from(result.value),
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
            val request = runCatching {
                json.decodeFromJsonElement(UpdatePlatformParamAdjustmentRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (payload.hasInvalidNull("value", "template")) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.AdjustmentUpdate(
                request.value?.trim(),
                "value" in payload,
                request.template?.trim(),
                "template" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(InvariantPlatformParamAdjustmentResponse.from(result.value))
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
