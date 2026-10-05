package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.AppearanceRepository
import com.dsbuilder.ds.components.application.CreateAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.GetAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationValuesUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceVariationValueUseCase
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

/** Registers appearance variation-value CRUD routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.appearanceVariationValueRoutes(
    evaluator: PolicyEvaluator,
    list: ListAppearanceVariationValuesUseCase,
    get: GetAppearanceVariationValueUseCase,
    create: CreateAppearanceVariationValueUseCase,
    update: UpdateAppearanceVariationValueUseCase,
    delete: DeleteAppearanceVariationValueUseCase,
    json: Json,
) {
    route("/api/ds/appearance-variation-values") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(AppearanceVariationValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(AppearanceVariationValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val payload = call.receive<JsonObject>()
            val request = runCatching {
                json.decodeFromJsonElement(CreateAppearanceVariationValueRequest.serializer(), payload)
            }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val appearanceVariationId = request.appearanceVariationId.toUuidOrNull()
            val styleId = request.styleId.toUuidOrNull()
            if (appearanceVariationId == null || styleId == null || (request.authoredId?.length ?: 0) > 255) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceRepository.ValueCreate(
                appearanceVariationId,
                styleId,
                request.position,
                request.authoredId?.trim(),
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    AppearanceVariationValueResponse.from(result.value),
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
                json.decodeFromJsonElement(UpdateAppearanceVariationValueRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if ((request.authoredId?.trim()?.length ?: 0) > 255) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceRepository.ValueUpdate(
                request.position,
                request.authoredId?.trim(),
                "authoredId" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(AppearanceVariationValueResponse.from(result.value))
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
