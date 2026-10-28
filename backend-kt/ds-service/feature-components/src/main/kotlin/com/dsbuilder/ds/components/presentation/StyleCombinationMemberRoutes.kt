package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.CreateStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.DeleteStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.GetStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.ListStyleCombinationMembersUseCase
import com.dsbuilder.ds.components.application.StyleCombinationRepository
import com.dsbuilder.ds.components.domain.StyleCombinationMember
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

/** Registers flat style-combination member routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod")
fun Route.styleCombinationMemberRoutes(
    evaluator: PolicyEvaluator,
    list: ListStyleCombinationMembersUseCase,
    get: GetStyleCombinationMemberUseCase,
    create: CreateStyleCombinationMemberUseCase,
    delete: DeleteStyleCombinationMemberUseCase,
    json: Json,
) {
    route(dsRoutePath("/api/ds/style-combination-members")) {
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
                    result.value.map(StyleCombinationMemberResponse::from),
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
                is DsResult.Success -> call.respondSuccess(result, StyleCombinationMemberResponse.from(result.value))
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
            val request = runCatching { call.receive<CreateStyleCombinationMemberRequest>() }.getOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val combinationId = request.combinationId.toUuidOrNull()
            val styleId = request.styleId.toUuidOrNull()
            if (combinationId == null || styleId == null) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = StyleCombinationRepository.MemberCreate(combinationId, styleId)
            val createContext = context.withIdempotentResponse { value: StyleCombinationMember ->
                json.encodeToString(
                    StyleCombinationMemberResponse.serializer(),
                    StyleCombinationMemberResponse.from(value),
                )
            }
            when (val result = create.execute(createContext, command, call.request.headers["Idempotency-Key"])) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    StyleCombinationMemberResponse.from(result.value),
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
