package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersion
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.DeleteDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemVersionsUseCase
import com.dsbuilder.ds.designsystems.application.ListVersionsByDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemVersion
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.PublicationStatus
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** Registers all design-system version operations. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.designSystemVersionRoutes(
    evaluator: PolicyEvaluator,
    list: ListDesignSystemVersionsUseCase,
    get: GetDesignSystemVersionUseCase,
    listByDesignSystem: ListVersionsByDesignSystemUseCase,
    create: CreateDesignSystemVersionUseCase,
    update: UpdateDesignSystemVersionUseCase,
    delete: DeleteDesignSystemVersionUseCase,
    json: Json,
) {
    route("/api/ds/design-system-versions") {
        get {
            val context = context(evaluator) ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemVersionResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-design-system/{designSystemId}") {
            val context = context(evaluator) ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["designSystemId"]?.uuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = listByDesignSystem.execute(context, DesignSystemId(id))) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemVersionResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = context(evaluator) ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.uuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(DesignSystemVersionResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = context(evaluator) ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateDesignSystemVersionRequest>()
            val designSystemId = request.designSystemId.uuid()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val status = request.publicationStatus?.let(PublicationStatus::fromWire)
            if (
                request.publicationStatus != null && status == null ||
                request.version.trim().isEmpty() ||
                request.version.length > 50
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = CreateDesignSystemVersion(
                DesignSystemId(designSystemId),
                request.version.trim(),
                request.snapshot.toString(),
                request.changelog?.trim(),
                status,
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(
                    HttpStatusCode.Created,
                    DesignSystemVersionResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = context(evaluator) ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.uuid()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            val request = runCatching {
                json.decodeFromJsonElement(UpdateDesignSystemVersionRequest.serializer(), payload)
            }.getOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val status = request.publicationStatus?.let(PublicationStatus::fromWire)
            if (request.publicationStatus != null && status == null) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = UpdateDesignSystemVersion(
                request.changelog?.trim(),
                "changelog" in payload,
                status,
                "publicationStatus" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(DesignSystemVersionResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = context(evaluator) ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.uuid()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = delete.execute(context, id)) {
                is DsResult.Success -> call.respond(OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

private fun io.ktor.server.routing.RoutingContext.context(evaluator: PolicyEvaluator) =
    TrustedDsRequestContextMapper.map(call.request.headers, evaluator)

private fun String.uuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
