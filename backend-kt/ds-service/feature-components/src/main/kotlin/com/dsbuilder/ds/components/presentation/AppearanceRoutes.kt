package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.AppearanceRepository
import com.dsbuilder.ds.components.application.CreateAppearanceUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceUseCase
import com.dsbuilder.ds.components.application.GetAppearanceUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationAxesUseCase
import com.dsbuilder.ds.components.application.ListAppearancesUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceUseCase
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

/** Registers appearance CRUD and nested variation-axis routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.appearanceRoutes(
    evaluator: PolicyEvaluator,
    list: ListAppearancesUseCase,
    get: GetAppearanceUseCase,
    create: CreateAppearanceUseCase,
    update: UpdateAppearanceUseCase,
    delete: DeleteAppearanceUseCase,
    axes: ListAppearanceVariationAxesUseCase,
    json: Json,
) {
    route("/api/ds/appearances") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(AppearanceResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(AppearanceResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateAppearanceRequest>()
            val designSystemId = request.designSystemId.toUuidOrNull()
            val componentId = request.componentId.toUuidOrNull()
            if (
                designSystemId == null || componentId == null || request.name.trim().length > 255 ||
                (request.platform != null && request.platform !in componentPlatforms)
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceRepository.AppearanceCreate(
                designSystemId,
                componentId,
                request.name.trim(),
                request.platform,
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(HttpStatusCode.Created, AppearanceResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            val request = runCatching { json.decodeFromJsonElement(UpdateAppearanceRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                payload.hasInvalidNull("name") || (request.name != null && !request.name.validName()) ||
                (request.platform != null && request.platform !in componentPlatforms)
            ) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceRepository.AppearanceUpdate(
                request.name?.trim(),
                request.platform,
                "platform" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(AppearanceResponse.from(result.value))
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
        get("/{id}/variations") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = axes.execute(context, id)) {
                is DsResult.Success -> call.respond(result.value.map(AppearanceVariationAxisResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
