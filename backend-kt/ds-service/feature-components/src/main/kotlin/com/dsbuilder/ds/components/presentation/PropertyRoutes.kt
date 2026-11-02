package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.CreatePropertyUseCase
import com.dsbuilder.ds.components.application.GetPropertyUseCase
import com.dsbuilder.ds.components.application.ListPropertiesUseCase
import com.dsbuilder.ds.components.application.UpdatePropertyUseCase
import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
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

/** Registers component property CRUD routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.propertyRoutes(
    evaluator: PolicyEvaluator,
    list: ListPropertiesUseCase,
    get: GetPropertyUseCase,
    create: CreatePropertyUseCase,
    update: UpdatePropertyUseCase,
    json: Json,
) {
    route(dsRoutePath("/api/ds/properties")) {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(ComponentPropertySummaryResponse::from),
                )
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
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentPropertySummaryResponse.from(result.value))
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
            val command = ComponentModelRepository.PropertyCreate(
                componentId,
                request.name.trim(),
                request.type,
                request.defaultValue?.trim(),
                request.description?.trim(),
            )
            when (
                val result = create.execute(
                    context.withIdempotentResponse { value: ComponentPropertySummary ->
                        json.encodeToString(ComponentPropertySummaryResponse.from(value))
                    },
                    command,
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    ComponentPropertySummaryResponse.from(result.value),
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
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            val request = runCatching { json.decodeFromJsonElement(UpdatePropertyRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                payload.hasInvalidNull("name", "type", "defaultValue", "description") ||
                (request.name != null && !request.name.validName()) ||
                (request.type != null && request.type !in propertyTypes) ||
                !request.description.validDescription()
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
            )
            val mutation = call.repeatableMutation(
                context,
                payload,
                json = json,
                response = ComponentPropertySummaryResponse::from,
            )
            when (val result = update.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentPropertySummaryResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
