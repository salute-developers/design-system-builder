package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.DeleteStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.GetStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.ListStyleCombinationMembersUseCase
import com.dsbuilder.ds.components.application.StyleCombinationRepository
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

/** Registers flat style-combination member routes. */
@Suppress("CyclomaticComplexMethod")
fun Route.styleCombinationMemberRoutes(
    evaluator: PolicyEvaluator,
    list: ListStyleCombinationMembersUseCase,
    get: GetStyleCombinationMemberUseCase,
    create: CreateStyleCombinationMemberUseCase,
    delete: DeleteStyleCombinationMemberUseCase,
) {
    route("/api/ds/style-combination-members") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(StyleCombinationMemberResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(StyleCombinationMemberResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = runCatching { call.receive<CreateStyleCombinationMemberRequest>() }.getOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val combinationId = request.combinationId.toUuidOrNull()
            val styleId = request.styleId.toUuidOrNull()
            if (combinationId == null || styleId == null) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = StyleCombinationRepository.MemberCreate(combinationId, styleId)
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    StyleCombinationMemberResponse.from(result.value),
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
