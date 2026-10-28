package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.CreateVariationUseCase
import com.dsbuilder.ds.components.application.GetVariationUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertiesUseCase
import com.dsbuilder.ds.components.application.ListVariationStylesUseCase
import com.dsbuilder.ds.components.application.ListVariationsUseCase
import com.dsbuilder.ds.components.application.UpdateVariationUseCase
import com.dsbuilder.ds.components.domain.ComponentVariationSummary
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

/** Registers variation CRUD and nested lookup routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.variationRoutes(
    evaluator: PolicyEvaluator,
    list: ListVariationsUseCase,
    get: GetVariationUseCase,
    create: CreateVariationUseCase,
    update: UpdateVariationUseCase,
    styles: ListVariationStylesUseCase,
    properties: ListVariationPropertiesUseCase,
    json: Json,
) {
    route("/api/ds/variations") {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val designSystemId = call.request.queryParameters["designSystemId"]?.let {
                it.toUuidOrNull()
                    ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_design_system_id"))
            }
            when (val result = list.execute(context, designSystemId)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(ComponentVariationSummaryResponse::from),
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
                is DsResult.Success -> call.respondSuccess(result, ComponentVariationSummaryResponse.from(result.value))
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
            val request = call.receive<CreateVariationRequest>()
            val designSystemId = request.designSystemId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val componentId = request.componentId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (!request.name.validName() || !request.description.validDescription()) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.VariationCreate(
                designSystemId,
                componentId,
                request.name.trim(),
                request.description?.trim(),
            )
            when (
                val result = create.execute(
                    context.withIdempotentResponse { value: ComponentVariationSummary ->
                        json.encodeToString(ComponentVariationSummaryResponse.from(value))
                    },
                    command,
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    ComponentVariationSummaryResponse.from(result.value),
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
            val request = runCatching { json.decodeFromJsonElement(UpdateVariationRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                payload.hasInvalidNull("name", "description") ||
                (request.name != null && !request.name.validName()) ||
                !request.description.validDescription()
            ) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.VariationUpdate(
                request.name?.trim(),
                request.description?.trim(),
                "description" in payload,
            )
            val mutation = call.repeatableMutation(
                context,
                payload,
                json = json,
                response = ComponentVariationSummaryResponse::from,
            )
            when (val result = update.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentVariationSummaryResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/styles") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = styles.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(ComponentStyleSummaryResponse::from),
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
    }
}
