package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.CreatePropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.GetPropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.ListPropertyPlatformParamsUseCase
import com.dsbuilder.ds.components.application.UpdatePropertyPlatformParamUseCase
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
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/** Registers property platform-param CRUD routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.propertyPlatformParamRoutes(
    evaluator: PolicyEvaluator,
    list: ListPropertyPlatformParamsUseCase,
    get: GetPropertyPlatformParamUseCase,
    create: CreatePropertyPlatformParamUseCase,
    update: UpdatePropertyPlatformParamUseCase,
    json: Json,
) {
    route("/api/ds/property-platform-params") {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(PropertyPlatformParamResponse::from),
                )
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
                is DsResult.Success -> call.respondSuccess(result, PropertyPlatformParamResponse.from(result.value))
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
            val request = call.receive<CreatePropertyPlatformParamRequest>()
            val propertyId = request.propertyId.toUuidOrNull()
            if (propertyId == null || request.platform !in propertyPlatforms || !request.name.validName()) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.PlatformParamCreate(
                propertyId,
                request.platform,
                request.name.trim(),
                request.deprecated,
                request.deprecatedMessage,
            )
            when (
                val result = create.execute(
                    context.withIdempotentResponse { value: com.dsbuilder.ds.components.domain.PropertyPlatformParam ->
                        json.encodeToString(PropertyPlatformParamResponse.from(value))
                    },
                    command,
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    PropertyPlatformParamResponse.from(result.value),
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
            val request = runCatching {
                json.decodeFromJsonElement(UpdatePropertyPlatformParamRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                (request.platform != null && request.platform !in propertyPlatforms) ||
                (request.name != null && !request.name.validName())
            ) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.PlatformParamUpdate(
                request.platform,
                request.name?.trim(),
                request.deprecated,
                request.deprecatedMessage,
                "deprecatedMessage" in payload,
            )
            val mutation = call.repeatableMutation(
                context,
                payload,
                json = json,
                response = PropertyPlatformParamResponse::from,
            )
            when (val result = update.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, PropertyPlatformParamResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
