package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.AppearanceRepository
import com.dsbuilder.ds.components.application.CreateAppearanceUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceUseCase
import com.dsbuilder.ds.components.application.GetAppearanceUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationAxesUseCase
import com.dsbuilder.ds.components.application.ListAppearancesUseCase
import com.dsbuilder.ds.components.application.ListComponentConfigurationsUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceUseCase
import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.modelReadContext
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

/** Registers appearance CRUD and nested variation-axis routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.appearanceRoutes(
    evaluator: PolicyEvaluator,
    list: ListAppearancesUseCase,
    configurations: ListComponentConfigurationsUseCase,
    get: GetAppearanceUseCase,
    create: CreateAppearanceUseCase,
    update: UpdateAppearanceUseCase,
    delete: DeleteAppearanceUseCase,
    axes: ListAppearanceVariationAxesUseCase,
    json: Json,
) {
    route(dsRoutePath("/api/ds/appearances")) {
        get {
            val query = call.request.queryParameters
            if (query["designSystemId"] != null || query["componentId"] != null) {
                val context = call.modelReadContext(evaluator) ?: return@get
                val designSystemId = query["designSystemId"].toUuidOrNull()
                    ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_design_system_id"))
                val componentId = query["componentId"].toUuidOrNull()
                    ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_component_id"))
                val limit = query["limit"]?.toIntOrNull() ?: 20
                when (
                    val result = configurations.execute(
                        context,
                        designSystemId,
                        componentId,
                        limit,
                        query["cursor"],
                    )
                ) {
                    is DsResult.Success -> call.respondSuccess(
                        result,
                        ComponentConfigurationsResponse.from(result.value),
                    )
                    is DsResult.Failure -> call.respondFailure(result.error)
                }
                return@get
            }
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(), evaluator, call.request.queryParameters["versionId"],
            ) ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(AppearanceResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(), evaluator, call.request.queryParameters["versionId"],
            ) ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, AppearanceResponse.from(result.value))
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
            val request = call.receive<CreateAppearanceRequest>()
            val designSystemId = request.designSystemId.toUuidOrNull()
            val componentId = request.componentId.toUuidOrNull()
            if (
                designSystemId == null || componentId == null || request.name.trim().length > 255
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceRepository.AppearanceCreate(
                designSystemId,
                componentId,
                request.name.trim(),
            )
            val createContext = context.withIdempotentResponse { value: Appearance ->
                json.encodeToString(AppearanceResponse.serializer(), AppearanceResponse.from(value))
            }
            when (val result = create.execute(createContext, command, call.dsTrustedHeaders()["Idempotency-Key"])) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    AppearanceResponse.from(result.value),
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
            val request = runCatching { json.decodeFromJsonElement(UpdateAppearanceRequest.serializer(), payload) }
                .getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                payload.hasInvalidNull("name") || (request.name != null && !request.name.validName())
            ) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceRepository.AppearanceUpdate(request.name?.trim())
            val mutation = call.repeatableMutation(
                context,
                payload,
                json = json,
                response = AppearanceResponse::from,
            )
            when (val result = update.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, AppearanceResponse.from(result.value))
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
        get("/{id}/variations") {
            val context = call.modelReadContext(evaluator) ?: return@get
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = axes.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(AppearanceVariationAxisResponse::from),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
