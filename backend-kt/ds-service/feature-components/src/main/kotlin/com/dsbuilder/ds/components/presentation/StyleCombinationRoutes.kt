package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.AddStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.CreateStyleCombinationUseCase
import com.dsbuilder.ds.components.application.DeleteStyleCombinationUseCase
import com.dsbuilder.ds.components.application.GetStyleCombinationUseCase
import com.dsbuilder.ds.components.application.ListMembersByStyleCombinationUseCase
import com.dsbuilder.ds.components.application.ListStyleCombinationsUseCase
import com.dsbuilder.ds.components.application.StyleCombinationRepository
import com.dsbuilder.ds.components.application.UpdateStyleCombinationUseCase
import com.dsbuilder.ds.components.domain.StyleCombination
import com.dsbuilder.ds.components.domain.StyleCombinationMember
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
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

/** Registers style-combination routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.styleCombinationRoutes(
    evaluator: PolicyEvaluator,
    list: ListStyleCombinationsUseCase,
    get: GetStyleCombinationUseCase,
    create: CreateStyleCombinationUseCase,
    update: UpdateStyleCombinationUseCase,
    delete: DeleteStyleCombinationUseCase,
    listMembers: ListMembersByStyleCombinationUseCase,
    addMember: AddStyleCombinationMemberUseCase,
    json: Json,
) {
    route("/api/ds/style-combinations") {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(StyleCombinationResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, StyleCombinationResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val payload = call.receive<JsonObject>()
            if (payload.hasInvalidNull("combinationKey", "tokenId", "alpha", "adjustment")) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val request = runCatching {
                json.decodeFromJsonElement(CreateStyleCombinationRequest.serializer(), payload)
            }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val createContext = context.withIdempotentResponse { value: StyleCombination ->
                json.encodeToString(StyleCombinationResponse.serializer(), StyleCombinationResponse.from(value))
            }
            when (val result = create.execute(createContext, command, call.request.headers["Idempotency-Key"])) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    StyleCombinationResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            if (payload.hasInvalidNull("value", "tokenId", "alpha", "adjustment", "stateSetId")) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val request = runCatching {
                json.decodeFromJsonElement(UpdateStyleCombinationRequest.serializer(), payload)
            }.getOrNull() ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand(payload)
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, StyleCombinationResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = delete.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/members") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = listMembers.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    result.value.map(NestedStyleCombinationMemberResponse::from),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post("/{id}/members") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val request = runCatching { call.receive<CreateStyleCombinationMemberRequest>() }.getOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (request.combinationId.toUuidOrNull() == null) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val styleId = request.styleId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val createContext = context.withIdempotentResponse { value: StyleCombinationMember ->
                json.encodeToString(
                    StyleCombinationMemberResponse.serializer(),
                    StyleCombinationMemberResponse.from(value),
                )
            }
            when (
                val result = addMember.execute(
                    createContext,
                    StyleCombinationRepository.MemberCreate(id, styleId),
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    StyleCombinationMemberResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

@Suppress("ReturnCount")
private fun CreateStyleCombinationRequest.toCommand(): StyleCombinationRepository.Create? {
    val propertyUuid = propertyId.toUuidOrNull() ?: return null
    val appearanceUuid = appearanceId.toUuidOrNull() ?: return null
    val tokenUuid = tokenId?.toUuidOrNull()
    val stateSetUuid = stateSetId.toUuidOrNull() ?: return null
    if (tokenId != null && tokenUuid == null || value.trim().isEmpty()) return null
    return StyleCombinationRepository.Create(
        propertyUuid,
        appearanceUuid,
        combinationKey?.trim(),
        value.trim(),
        tokenUuid,
        alpha?.trim(),
        adjustment?.trim(),
        stateSetUuid,
    )
}

@Suppress("ComplexCondition")
private fun UpdateStyleCombinationRequest.toCommand(payload: JsonObject): StyleCombinationRepository.Update? {
    val tokenUuid = tokenId?.toUuidOrNull()
    val stateSetUuid = stateSetId?.toUuidOrNull()
    if (tokenId != null && tokenUuid == null || stateSetId != null && stateSetUuid == null) return null
    if (value != null && value.trim().isEmpty()) return null
    return StyleCombinationRepository.Update(
        value?.trim(),
        tokenUuid,
        "tokenId" in payload,
        alpha?.trim(),
        "alpha" in payload,
        adjustment?.trim(),
        "adjustment" in payload,
        stateSetUuid,
    )
}
