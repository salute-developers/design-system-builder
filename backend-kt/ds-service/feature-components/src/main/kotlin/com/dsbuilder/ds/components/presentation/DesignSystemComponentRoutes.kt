package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.DeleteDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.GetDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.ListDesignSystemComponentsUseCase
import com.dsbuilder.ds.components.domain.DesignSystemComponent
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
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json

/** Registers design-system component link routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod")
fun Route.designSystemComponentRoutes(
    evaluator: PolicyEvaluator,
    list: ListDesignSystemComponentsUseCase,
    get: GetDesignSystemComponentUseCase,
    create: CreateDesignSystemComponentUseCase,
    delete: DeleteDesignSystemComponentUseCase,
    json: Json,
) {
    route(dsRoutePath("/api/ds/design-system-components")) {
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
                    result.value.map(DesignSystemComponentResponse::from),
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
                is DsResult.Success -> call.respondSuccess(result, DesignSystemComponentResponse.from(result.value))
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
            val request = call.receive<CreateDesignSystemComponentRequest>()
            val designSystemId = request.designSystemId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_design_system_id"))
            val componentId = request.componentId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_component_id"))
            when (
                val result = create.execute(
                    context.withIdempotentResponse { value: DesignSystemComponent ->
                        json.encodeToString(
                            DesignSystemComponentResponse.serializer(),
                            DesignSystemComponentResponse.from(value),
                        )
                    },
                    designSystemId,
                    componentId,
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    DesignSystemComponentResponse.from(result.value),
                )
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
