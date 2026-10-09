package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemChange
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemChangeUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemChangeUseCase
import com.dsbuilder.ds.designsystems.application.ListChangesByDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemChangeEntriesUseCase
import com.dsbuilder.ds.designsystems.domain.ChangeOperation
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import java.util.UUID

/** Registers top-level and nested design-system change routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.designSystemChangeRoutes(
    evaluator: PolicyEvaluator,
    list: ListDesignSystemChangeEntriesUseCase,
    get: GetDesignSystemChangeUseCase,
    listByDesignSystem: ListChangesByDesignSystemUseCase,
    create: CreateDesignSystemChangeUseCase,
) {
    route("/api/ds/design-system-changes") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemChangeResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-design-system/{designSystemId}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["designSystemId"]?.uuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            respondChanges(listByDesignSystem.execute(context, DesignSystemId(id), missingAsEmpty = true))
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.uuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(DesignSystemChangeResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateDesignSystemChangeRequest>()
            val designSystemId = request.designSystemId.uuid()
            val entityId = request.entityId.uuid()
            val operation = ChangeOperation.fromWire(request.operation)
            if (
                designSystemId == null ||
                entityId == null ||
                operation == null ||
                request.entityType.trim().isEmpty()
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = CreateDesignSystemChange(
                DesignSystemId(designSystemId),
                request.entityType.trim(),
                entityId,
                operation,
                request.data?.toString(),
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    DesignSystemChangeResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
    get("/api/ds/design-systems/{id}/changes") {
        val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
            ?: return@get call.respondFailure(DsFailure.Forbidden)
        val id = call.parameters["id"]?.uuid()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        respondChanges(listByDesignSystem.execute(context, DesignSystemId(id)))
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.respondChanges(
    result: DsResult<List<com.dsbuilder.ds.designsystems.domain.DesignSystemChange>>,
) {
    when (result) {
        is DsResult.Success -> call.respond(result.value.map(DesignSystemChangeResponse::from))
        is DsResult.Failure -> call.respondFailure(result.error)
    }
}

private fun String.uuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
