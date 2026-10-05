package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentRepository
import com.dsbuilder.ds.components.application.CreateComponentUseCase
import com.dsbuilder.ds.components.application.DeleteComponentUseCase
import com.dsbuilder.ds.components.application.GetComponentUseCase
import com.dsbuilder.ds.components.application.ListComponentPropertiesUseCase
import com.dsbuilder.ds.components.application.ListComponentVariationsUseCase
import com.dsbuilder.ds.components.application.ListComponentsUseCase
import com.dsbuilder.ds.components.application.ListDependenciesByComponentUseCase
import com.dsbuilder.ds.components.application.UpdateComponentUseCase
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
import java.util.UUID

/** Registers component CRUD and nested lookup routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.componentRoutes(
    evaluator: PolicyEvaluator,
    list: ListComponentsUseCase,
    get: GetComponentUseCase,
    create: CreateComponentUseCase,
    update: UpdateComponentUseCase,
    delete: DeleteComponentUseCase,
    variations: ListComponentVariationsUseCase,
    properties: ListComponentPropertiesUseCase,
    dependencies: ListDependenciesByComponentUseCase,
    json: Json,
) {
    route("/api/ds/components") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(ComponentResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateComponentRequest>()
            val name = request.name.trim()
            val description = request.description?.trim()
            if (name.isEmpty() || name.length > 255 || (description?.length ?: 0) > 1000) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            when (val result = create.execute(context, ComponentRepository.Create(name, description))) {
                is DsResult.Success -> call.respond(HttpStatusCode.Created, ComponentResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            val request = runCatching { json.decodeFromJsonElement(UpdateComponentRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val name = request.name?.trim()
            val description = request.description?.trim()
            if (name != null && (name.isEmpty() || name.length > 255) || (description?.length ?: 0) > 1000) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentRepository.Update(name, description, "description" in payload)
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(ComponentResponse.from(result.value))
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
            when (val result = variations.execute(context, id)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentVariationSummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/properties") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = properties.execute(context, id)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentPropertySummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/deps") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = dependencies.execute(context, id)) {
                is DsResult.Success -> call.respond(ComponentDependencyGraphResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

internal fun String?.toUuidOrNull(): UUID? = this?.let { runCatching { UUID.fromString(it) }.getOrNull() }
