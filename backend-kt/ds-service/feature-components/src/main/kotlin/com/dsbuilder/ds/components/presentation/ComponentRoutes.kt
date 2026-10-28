package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentRepository
import com.dsbuilder.ds.components.application.CreateComponentUseCase
import com.dsbuilder.ds.components.application.GetComponentUseCase
import com.dsbuilder.ds.components.application.ListComponentPropertiesUseCase
import com.dsbuilder.ds.components.application.ListComponentVariationsUseCase
import com.dsbuilder.ds.components.application.ListComponentsUseCase
import com.dsbuilder.ds.components.application.ListDependenciesByComponentUseCase
import com.dsbuilder.ds.components.application.UpdateComponentUseCase
import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.repeatableMutation
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
import java.util.UUID

/** Registers component CRUD and nested lookup routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.componentRoutes(
    evaluator: PolicyEvaluator,
    list: ListComponentsUseCase,
    get: GetComponentUseCase,
    create: CreateComponentUseCase,
    update: UpdateComponentUseCase,
    variations: ListComponentVariationsUseCase,
    properties: ListComponentPropertiesUseCase,
    dependencies: ListDependenciesByComponentUseCase,
    json: Json,
) {
    route("/api/ds/components") {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(ComponentResponse::from))
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
                is DsResult.Success -> call.respondSuccess(result, ComponentResponse.from(result.value))
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
            val request = call.receive<CreateComponentRequest>()
            val name = request.name.trim()
            val description = request.description?.trim()
            if (
                name.isEmpty() || name.length > 255 || (description?.length ?: 0) > 1000 ||
                request.platform !in componentPlatforms
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            when (
                val result = create.execute(
                    context.withIdempotentResponse { value: Component ->
                        json.encodeToString(ComponentResponse.from(value))
                    },
                    ComponentRepository.Create(name, request.platform, description),
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    ComponentResponse.from(result.value),
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
            val request = runCatching { json.decodeFromJsonElement(UpdateComponentRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val name = request.name?.trim()
            val description = request.description?.trim()
            if (name != null && (name.isEmpty() || name.length > 255) || (description?.length ?: 0) > 1000) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentRepository.Update(name, description, "description" in payload)
            val mutation = call.repeatableMutation(
                context,
                payload,
                json = json,
                response = ComponentResponse::from,
            )
            when (val result = update.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/variations") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val designSystemId = call.request.queryParameters["designSystemId"]?.let {
                it.toUuidOrNull()
                    ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_design_system_id"))
            }
            when (val result = variations.execute(context, id, designSystemId)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(ComponentVariationSummaryResponse::from),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/properties") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = properties.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(ComponentPropertySummaryResponse::from),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/deps") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = dependencies.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentDependencyGraphResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

internal fun String?.toUuidOrNull(): UUID? = this?.let { runCatching { UUID.fromString(it) }.getOrNull() }
