package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.DeleteDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.GetDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.ListDesignSystemComponentsUseCase
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
import io.ktor.server.routing.post
import io.ktor.server.routing.route

/** Registers design-system component link routes. */
@Suppress("CyclomaticComplexMethod")
fun Route.designSystemComponentRoutes(
    evaluator: PolicyEvaluator,
    list: ListDesignSystemComponentsUseCase,
    get: GetDesignSystemComponentUseCase,
    create: CreateDesignSystemComponentUseCase,
    delete: DeleteDesignSystemComponentUseCase,
) {
    route("/api/ds/design-system-components") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemComponentResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(DesignSystemComponentResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateDesignSystemComponentRequest>()
            val designSystemId = request.designSystemId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_design_system_id"))
            val componentId = request.componentId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_component_id"))
            when (val result = create.execute(context, designSystemId, componentId)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    DesignSystemComponentResponse.from(result.value),
                )
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
