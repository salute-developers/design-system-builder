package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.AppearanceRepository
import com.dsbuilder.ds.components.application.CreateAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.GetAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationsUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceVariationUseCase
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

/** Registers appearance variation-axis CRUD routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.appearanceVariationRoutes(
    evaluator: PolicyEvaluator,
    list: ListAppearanceVariationsUseCase,
    get: GetAppearanceVariationUseCase,
    create: CreateAppearanceVariationUseCase,
    update: UpdateAppearanceVariationUseCase,
    delete: DeleteAppearanceVariationUseCase,
    json: Json,
) {
    route("/api/ds/appearance-variations") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(AppearanceVariationResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(AppearanceVariationResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val payload = call.receive<JsonObject>()
            val request = runCatching {
                json.decodeFromJsonElement(CreateAppearanceVariationRequest.serializer(), payload)
            }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val appearanceId = request.appearanceId.toUuidOrNull()
            val variationId = request.variationId.toUuidOrNull()
            val defaultStyleId = request.defaultStyleId?.toUuidOrNull()
            if (
                appearanceId == null || variationId == null ||
                (request.defaultStyleId != null && defaultStyleId == null) ||
                (request.declaredType?.trim()?.length ?: 0) > 255
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceRepository.VariationCreate(
                appearanceId,
                variationId,
                request.position,
                defaultStyleId,
                request.isColorScheme,
                request.declaredType?.trim(),
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    AppearanceVariationResponse.from(result.value),
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
                json.decodeFromJsonElement(UpdateAppearanceVariationRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val defaultStyleId = request.defaultStyleId?.toUuidOrNull()
            if (
                (request.defaultStyleId != null && defaultStyleId == null) ||
                (request.declaredType?.trim()?.length ?: 0) > 255
            ) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceRepository.VariationUpdate(
                request.position,
                defaultStyleId,
                "defaultStyleId" in payload,
                request.isColorScheme,
                request.declaredType?.trim(),
                "declaredType" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(AppearanceVariationResponse.from(result.value))
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
