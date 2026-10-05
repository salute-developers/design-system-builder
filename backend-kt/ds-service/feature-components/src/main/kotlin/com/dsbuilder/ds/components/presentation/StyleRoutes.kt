package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateStyleUseCase
import com.dsbuilder.ds.components.application.DeleteStyleUseCase
import com.dsbuilder.ds.components.application.GetStyleUseCase
import com.dsbuilder.ds.components.application.ListStylesByVariationAndDesignSystemUseCase
import com.dsbuilder.ds.components.application.ListStylesUseCase
import com.dsbuilder.ds.components.application.StyleRepository
import com.dsbuilder.ds.components.application.UpdateStyleUseCase
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
    route("/api/ds/styles") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentStyleSummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-variation/{variationId}/by-design-system/{designSystemId}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val variationId = call.parameters["variationId"].toUuidOrNull()
            val designSystemId = call.parameters["designSystemId"].toUuidOrNull()
            if (variationId == null || designSystemId == null) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            }
            when (val result = byVariationAndDesignSystem.execute(context, variationId, designSystemId)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentStyleSummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(ComponentStyleSummaryResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
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
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    ComponentStyleSummaryResponse.from(result.value),
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
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(ComponentStyleSummaryResponse.from(result.value))
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
