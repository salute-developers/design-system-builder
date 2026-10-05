package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentReuseConfigRepository
import com.dsbuilder.ds.components.application.CreateComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.DeleteComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.GetComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.ListComponentReuseConfigsByDependencyUseCase
import com.dsbuilder.ds.components.application.ListComponentReuseConfigsUseCase
import com.dsbuilder.ds.components.application.UpdateComponentReuseConfigUseCase
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

/** Registers component reuse configuration routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.componentReuseConfigRoutes(
    evaluator: PolicyEvaluator,
    list: ListComponentReuseConfigsUseCase,
    get: GetComponentReuseConfigUseCase,
    listByDependency: ListComponentReuseConfigsByDependencyUseCase,
    create: CreateComponentReuseConfigUseCase,
    update: UpdateComponentReuseConfigUseCase,
    delete: DeleteComponentReuseConfigUseCase,
) {
    route("/api/ds/component-reuse-configs") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentReuseConfigResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-dep/{componentDepId}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val dependencyId = call.parameters["componentDepId"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_component_dep_id"))
            when (val result = listByDependency.execute(context, dependencyId)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentReuseConfigResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(ComponentReuseConfigResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val command = call.receive<CreateComponentReuseConfigRequest>().toCommand()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    ComponentReuseConfigResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val command = call.receive<UpdateComponentReuseConfigRequest>().toCommand()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(ComponentReuseConfigResponse.from(result.value))
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

@Suppress("ReturnCount")
private fun CreateComponentReuseConfigRequest.toCommand(): ComponentReuseConfigRepository.Create? {
    return ComponentReuseConfigRepository.Create(
        componentDepId.toUuidOrNull() ?: return null,
        designSystemId.toUuidOrNull() ?: return null,
        appearanceId.toUuidOrNull() ?: return null,
        variationId.toUuidOrNull() ?: return null,
        styleId.toUuidOrNull() ?: return null,
    )
}

@Suppress("ReturnCount")
private fun UpdateComponentReuseConfigRequest.toCommand(): ComponentReuseConfigRepository.Update? {
    return ComponentReuseConfigRepository.Update(
        appearanceId?.toUuidOrNull() ?: if (appearanceId == null) null else return null,
        variationId?.toUuidOrNull() ?: if (variationId == null) null else return null,
        styleId?.toUuidOrNull() ?: if (styleId == null) null else return null,
    )
}
