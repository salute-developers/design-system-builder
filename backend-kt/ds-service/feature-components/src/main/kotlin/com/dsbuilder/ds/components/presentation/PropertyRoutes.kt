package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.CreatePropertyUseCase
import com.dsbuilder.ds.components.application.DeletePropertyUseCase
import com.dsbuilder.ds.components.application.GetPropertyUseCase
import com.dsbuilder.ds.components.application.ListPropertiesUseCase
import com.dsbuilder.ds.components.application.UpdatePropertyUseCase
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

/** Registers component property CRUD routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.propertyRoutes(
    evaluator: PolicyEvaluator,
    list: ListPropertiesUseCase,
    get: GetPropertyUseCase,
    create: CreatePropertyUseCase,
    update: UpdatePropertyUseCase,
    delete: DeletePropertyUseCase,
    json: Json,
) {
    route("/api/ds/properties") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentPropertySummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(ComponentPropertySummaryResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val payload = call.receive<JsonObject>()
            val request = runCatching { json.decodeFromJsonElement(CreatePropertyRequest.serializer(), payload) }
                .getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val componentId = request.componentId?.toUuidOrNull()
            if (
                payload.hasInvalidNull("name", "type", "defaultValue", "description") ||
                (request.componentId != null && componentId == null) ||
                !request.name.validName() || request.type !in propertyTypes ||
                !request.description.validDescription()
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            if (request.platform != null && request.platform !in componentPlatforms) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.PropertyCreate(
                componentId,
                request.name.trim(),
                request.type,
                request.defaultValue?.trim(),
                request.description?.trim(),
                request.platform,
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    ComponentPropertySummaryResponse.from(result.value),
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
            val request = runCatching { json.decodeFromJsonElement(UpdatePropertyRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                payload.hasInvalidNull("name", "type", "defaultValue", "description") ||
                (request.name != null && !request.name.validName()) ||
                (request.type != null && request.type !in propertyTypes) ||
                !request.description.validDescription() ||
                (request.platform != null && request.platform !in componentPlatforms)
            ) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.PropertyUpdate(
                request.name?.trim(),
                request.type,
                request.defaultValue?.trim(),
                "defaultValue" in payload,
                request.description?.trim(),
                "description" in payload,
                request.platform,
                "platform" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(ComponentPropertySummaryResponse.from(result.value))
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
