package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.modelReadContext
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersion
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemVersionsUseCase
import com.dsbuilder.ds.designsystems.application.ListVersionsByDesignSystemUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID

/** Чтение публикаций и единственная команда перехода черновика в публикацию. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod")
fun Route.designSystemVersionRoutes(
    evaluator: PolicyEvaluator,
    list: ListDesignSystemVersionsUseCase,
    get: GetDesignSystemVersionUseCase,
    listByDesignSystem: ListVersionsByDesignSystemUseCase,
    publish: CreateDesignSystemVersionUseCase,
    json: Json,
) {
    route("/api/ds/design-system-versions") {
        get {
            val context = context(evaluator) ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(DesignSystemVersionResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-design-system/{designSystemId}") {
            val context = call.modelReadContext(evaluator) ?: return@get
            val id = call.parameters["designSystemId"]?.uuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = listByDesignSystem.execute(context, DesignSystemId(id))) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(DesignSystemVersionResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = context(evaluator) ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.uuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, DesignSystemVersionId(id))) {
                is DsResult.Success -> call.respondSuccess(result, DesignSystemVersionResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = context(evaluator) ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateDesignSystemVersionRequest>()
            val designSystemId = request.designSystemId.uuid()
            val draftId = request.draftId.uuid()
            val idempotencyKey = call.request.headers["Idempotency-Key"]
            if (
                designSystemId == null || draftId == null || request.draftRevision < 0 ||
                !VERSION_PATTERN.matches(request.version) ||
                idempotencyKey.isNullOrBlank()
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = CreateDesignSystemVersion(
                DesignSystemId(designSystemId),
                DesignSystemVersionId(draftId),
                request.draftRevision,
                request.version,
                request.changelog.trim(),
            )
            val responseContext = context.withIdempotentResponse { value: DesignSystemVersion ->
                json.encodeToString(DesignSystemVersionResponse.from(value))
            }
            when (val result = publish.execute(responseContext, command, idempotencyKey)) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    DesignSystemVersionResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

private fun io.ktor.server.routing.RoutingContext.context(evaluator: PolicyEvaluator) =
    TrustedDsRequestContextMapper.map(call.request.headers, evaluator, call.request.queryParameters["versionId"])

private fun String.uuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()

private val VERSION_PATTERN = Regex("^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$")
