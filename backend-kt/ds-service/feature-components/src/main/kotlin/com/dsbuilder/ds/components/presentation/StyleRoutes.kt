package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateStyleUseCase
import com.dsbuilder.ds.components.application.DeleteStyleUseCase
import com.dsbuilder.ds.components.application.GetStyleUseCase
import com.dsbuilder.ds.components.application.ListStylesByVariationAndDesignSystemUseCase
import com.dsbuilder.ds.components.application.ListStylesUseCase
import com.dsbuilder.ds.components.application.StyleRepository
import com.dsbuilder.ds.components.application.UpdateStyleUseCase
import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.repeatableMutation
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/** Registers component style CRUD and lookup routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.styleRoutes(
    evaluator: PolicyEvaluator,
    list: ListStylesUseCase,
    get: GetStyleUseCase,
    byVariationAndDesignSystem: ListStylesByVariationAndDesignSystemUseCase,
    create: CreateStyleUseCase,
    update: UpdateStyleUseCase,
    delete: DeleteStyleUseCase,
    json: Json,
) {
    route(dsRoutePath("/api/ds/styles")) {
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
                    result.value.map(ComponentStyleSummaryResponse::from),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-variation/{variationId}/by-design-system/{designSystemId}") {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val variationId = call.parameters["variationId"].toUuidOrNull()
            val designSystemId = call.parameters["designSystemId"].toUuidOrNull()
            if (variationId == null || designSystemId == null) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            }
            when (val result = byVariationAndDesignSystem.execute(context, variationId, designSystemId)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(ComponentStyleSummaryResponse::from),
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
                is DsResult.Success -> call.respondSuccess(result, ComponentStyleSummaryResponse.from(result.value))
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
            val request = runCatching { json.decodeFromJsonElement(CreateStyleRequest.serializer(), payload) }
                .getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val designSystemId = request.designSystemId.toUuidOrNull()
            val variationId = request.variationId.toUuidOrNull()
            if (
                designSystemId == null || variationId == null || !request.name.validName() ||
                !request.description.validDescription() || payload.hasInvalidNull("description")
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = StyleRepository.Create(
                designSystemId,
                variationId,
                request.name.trim(),
                request.description?.trim(),
            )
            val createContext = context.withIdempotentResponse { value: ComponentStyleSummary ->
                json.encodeToString(
                    ComponentStyleSummaryResponse.serializer(),
                    ComponentStyleSummaryResponse.from(value),
                )
            }
            when (val result = create.execute(createContext, command, call.request.headers["Idempotency-Key"])) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    ComponentStyleSummaryResponse.from(result.value),
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
            val request = runCatching { json.decodeFromJsonElement(UpdateStyleRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                payload.hasInvalidNull("name", "description") ||
                (request.name != null && !request.name.validName()) || !request.description.validDescription()
            ) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = StyleRepository.Update(
                request.name?.trim(),
                request.description?.trim(),
                "description" in payload,
            )
            val mutation = call.repeatableMutation(
                context,
                payload,
                json = json,
                response = ComponentStyleSummaryResponse::from,
            )
            when (val result = update.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentStyleSummaryResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val mutation = call.repeatableMutation(context, null, json = json) { _: Unit -> OkResponse() }
            when (val result = delete.execute(mutation, id)) {
                is DsResult.Success -> call.respondSuccess(result, OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
