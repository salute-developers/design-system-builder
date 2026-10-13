package com.dsbuilder.ds.themes.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.themes.application.CreateTenant
import com.dsbuilder.ds.themes.application.CreateTenantUseCase
import com.dsbuilder.ds.themes.application.DeleteTenantUseCase
import com.dsbuilder.ds.themes.application.GetTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.GetTenantUseCase
import com.dsbuilder.ds.themes.application.ListTenantsUseCase
import com.dsbuilder.ds.themes.application.SaveTenantTokenValues
import com.dsbuilder.ds.themes.application.SaveTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.UpdateTenant
import com.dsbuilder.ds.themes.application.UpdateTenantUseCase
import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.TenantTokenValueInput
import com.dsbuilder.ds.themes.domain.ThemeProfile
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** Registers external `tenants` routes for the themes feature. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.tenantRoutes(
    evaluator: PolicyEvaluator,
    list: ListTenantsUseCase,
    get: GetTenantUseCase,
    create: CreateTenantUseCase,
    update: UpdateTenantUseCase,
    delete: DeleteTenantUseCase,
    getTokenValues: GetTenantTokenValuesUseCase,
    saveTokenValues: SaveTenantTokenValuesUseCase,
    json: Json,
) {
    route("/api/ds/tenants") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(TenantResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(TenantResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/token-values") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = getTokenValues.execute(context, id)) {
                is DsResult.Success -> call.respond(result.value.map(TenantTokenValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        put("/{id}/token-values") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@put call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@put call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val request = runCatching { call.receive<BatchSaveTenantTokenValuesRequest>() }.getOrNull()
                ?: return@put call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val command = request.toCommand()
                ?: return@put call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = saveTokenValues.execute(context, id, command)) {
                is DsResult.Success -> call.respond(TenantTokenValuesSaveResponse(result.value.editRevision))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreateTenantRequest>()
            val designSystemId = request.designSystemId.toUuid()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val profile = ThemeProfile.fromWire(request.profile)
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (!request.valid() || (profile == ThemeProfile.CUSTOM && request.customPalette == null)) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = CreateTenant(
                designSystemId,
                request.name.trim().replace(Regex("\\s+"), " "),
                request.description?.trim(),
                ColorConfiguration(profile = profile, customPalette = request.customPalette?.toDomain()),
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(HttpStatusCode.Created, TenantResponse.from(result.value))
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
                json.decodeFromJsonElement(UpdateTenantRequest.serializer(), payload)
            }.getOrNull()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (!request.valid() || ("colorConfig" in payload && request.colorConfig == null)) {
                return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = UpdateTenant(
                request.name?.trim()?.replace(Regex("\\s+"), " "),
                "name" in payload,
                request.description?.trim(),
                "description" in payload,
                request.colorConfig?.toDomain(),
                "colorConfig" in payload,
            )
            when (val result = update.execute(context, id, command)) {
                is DsResult.Success -> call.respond(TenantResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.toUuid()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = delete.execute(context, id)) {
                is DsResult.Success -> call.respond(OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

private fun CreateTenantRequest.valid() = name.trim().isNotEmpty() && name.trim().length <= 255 &&
    (description?.trim()?.length ?: 0) <= 1000

private fun UpdateTenantRequest.valid() = (name?.trim()?.length ?: 0) <= 255 &&
    (description?.trim()?.length ?: 0) <= 1000

@Suppress("ReturnCount")
private fun BatchSaveTenantTokenValuesRequest.toCommand(): SaveTenantTokenValues? {
    if (editRevision < 0) return null
    val inputs = values.map { value ->
        val tokenId = value.tokenId.toUuid() ?: return null
        val paletteId = value.paletteId?.toUuid() ?: if (value.paletteId == null) null else return null
        val platform = ThemeTokenPlatform.fromWire(value.platform) ?: return null
        val mode = value.mode?.let(ThemeTokenMode::fromWire) ?: if (value.mode == null) null else return null
        TenantTokenValueInput(tokenId, platform, mode, paletteId, value.value)
    }
    return SaveTenantTokenValues(editRevision, inputs)
}

private fun String.toUuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
