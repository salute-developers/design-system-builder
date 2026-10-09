package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.designsystems.application.CreateDesignSystem
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.DeleteDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemAppearancesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentStylesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTenantsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTokensUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemsUseCase
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystem
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
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

/** Registers design-system CRUD routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.designSystemRoutes(
    evaluator: PolicyEvaluator,
    list: ListDesignSystemsUseCase,
    get: GetDesignSystemUseCase,
    create: CreateDesignSystemUseCase,
    update: UpdateDesignSystemUseCase,
    delete: DeleteDesignSystemUseCase,
    listComponents: ListDesignSystemComponentsUseCase,
    listTokens: ListDesignSystemTokensUseCase,
    listComponentStyles: ListDesignSystemComponentStylesUseCase,
    listTenants: ListDesignSystemTenantsUseCase,
    listAppearances: ListDesignSystemAppearancesUseCase,
    json: Json,
) {
    route("/api/ds/design-systems") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, DesignSystemId(id))) {
                is DsResult.Success -> call.respond(DesignSystemResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateDesignSystemRequest>()
            val command = request.toCommand()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(HttpStatusCode.Created, DesignSystemResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val payload = call.receive<JsonObject>()
            val request = runCatching {
                json.decodeFromJsonElement(UpdateDesignSystemRequest.serializer(), payload)
            }.getOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand("description" in payload)
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = update.execute(context, DesignSystemId(id), command)) {
                is DsResult.Success -> call.respond(DesignSystemResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = delete.execute(context, DesignSystemId(id))) {
                is DsResult.Success -> call.respond(OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/components") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (
                val result = listComponents.execute(
                    context,
                    DesignSystemId(id),
                    call.request.queryParameters["query"],
                )
            ) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemComponentSummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/tokens") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val type = call.request.queryParameters["type"]
            if (type != null && type !in TokenTypes) {
                return@get call.respondFailure(DsFailure.InvalidRequest("Invalid token type '$type'"))
            }
            when (
                val result = listTokens.execute(
                    context,
                    DesignSystemId(id),
                    type,
                    call.request.queryParameters["query"],
                )
            ) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemTokenSummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/components/{componentId}/styles") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val componentId = call.parameters["componentId"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_component_id"))
            when (val result = listComponentStyles.execute(context, DesignSystemId(id), componentId)) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemStyleSummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/tenants") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = listTenants.execute(context, DesignSystemId(id))) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemTenantSummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/appearances") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = listAppearances.execute(context, DesignSystemId(id))) {
                is DsResult.Success -> call.respond(result.value.map(DesignSystemAppearanceSummaryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

private val TokenTypes = setOf("color", "gradient", "typography", "fontFamily", "spacing", "shape", "shadow")

@Suppress("ReturnCount")
private fun CreateDesignSystemRequest.toCommand(): CreateDesignSystem? {
    val normalizedName = name.trim()
    val normalizedProjectName = projectName.trim()
    val normalizedDescription = description?.trim()
    if (normalizedName.isEmpty() || normalizedName.length > 255) return null
    if (normalizedProjectName.isEmpty() || normalizedProjectName.length > 255) return null
    if (normalizedDescription != null && normalizedDescription.length > 1000) return null
    return CreateDesignSystem(normalizedName, normalizedProjectName, normalizedDescription)
}

private fun UpdateDesignSystemRequest.toCommand(descriptionPresent: Boolean): UpdateDesignSystem? {
    val normalizedName = name?.trim()
    val normalizedDescription = description?.trim()
    if (normalizedName != null && (normalizedName.isEmpty() || normalizedName.length > 255)) return null
    if (normalizedDescription != null && normalizedDescription.length > 1000) return null
    return UpdateDesignSystem(normalizedName, normalizedDescription, descriptionPresent)
}

private fun String.toUuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
