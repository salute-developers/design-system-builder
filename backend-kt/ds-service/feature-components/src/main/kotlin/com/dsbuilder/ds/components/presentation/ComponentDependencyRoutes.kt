package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentDependencyRepository
import com.dsbuilder.ds.components.application.CreateComponentDependencyUseCase
import com.dsbuilder.ds.components.application.GetComponentDependencyUseCase
import com.dsbuilder.ds.components.application.ListComponentDependenciesUseCase
import com.dsbuilder.ds.components.application.UpdateComponentDependencyUseCase
import com.dsbuilder.ds.components.domain.ComponentDependency
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

/** Registers component dependency routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod")
fun Route.componentDependencyRoutes(
    evaluator: PolicyEvaluator,
    list: ListComponentDependenciesUseCase,
    get: GetComponentDependencyUseCase,
    create: CreateComponentDependencyUseCase,
    update: UpdateComponentDependencyUseCase,
    json: Json,
) {
    route(dsRoutePath("/api/ds/component-deps")) {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.dsTrustedHeaders(),
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(ComponentDependencyResponse::from))
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
                is DsResult.Success -> call.respondSuccess(result, ComponentDependencyResponse.from(result.value))
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
            val request = call.receive<CreateComponentDependencyRequest>()
            val command = request.toCommand()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (
                val result = create.execute(
                    context.withIdempotentResponse { value: ComponentDependency ->
                        json.encodeToString(ComponentDependencyResponse.from(value))
                    },
                    command,
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    ComponentDependencyResponse.from(result.value),
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
            val request = runCatching {
                json.decodeFromJsonElement(UpdateComponentDependencyRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val type = request.type?.let(ComponentDependency.RelationType::fromWire)
            if (request.type != null && type == null) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentDependencyRepository.Update(type, request.order, "order" in payload)
            val mutation = call.repeatableMutation(
                context,
                payload,
                json = json,
                response = ComponentDependencyResponse::from,
            )
            when (val result = update.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentDependencyResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

@Suppress("ReturnCount")
private fun CreateComponentDependencyRequest.toCommand(): ComponentDependencyRepository.Create? {
    val parentId = parentId.toUuidOrNull() ?: return null
    val childId = childId.toUuidOrNull() ?: return null
    val relationType = ComponentDependency.RelationType.fromWire(type) ?: return null
    return ComponentDependencyRepository.Create(parentId, childId, relationType, order)
}
