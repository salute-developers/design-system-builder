package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.GetStateSetUseCase
import com.dsbuilder.ds.components.application.ListStateSetsUseCase
import com.dsbuilder.ds.components.application.ResolveStateSetUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

/** Registers canonical state-set routes. */
@Suppress("CyclomaticComplexMethod")
fun Route.stateSetRoutes(
    evaluator: PolicyEvaluator,
    list: ListStateSetsUseCase,
    get: GetStateSetUseCase,
    resolve: ResolveStateSetUseCase,
) {
    route("/api/ds/state-sets") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentStateSetResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(ComponentStateSetResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post("/resolve") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = runCatching { call.receive<ResolveStateSetRequest>() }.getOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (request.stateIds.size > MAX_STATE_SET_SIZE) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val stateIds = request.stateIds.map { it.toUuidOrNull() }
            if (stateIds.any { it == null }) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            when (val result = resolve.execute(context, stateIds.filterNotNull())) {
                is DsResult.Success -> call.respond(
                    if (result.value.created) HttpStatusCode.Created else HttpStatusCode.OK,
                    ResolvedStateSetResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

private const val MAX_STATE_SET_SIZE = 32
