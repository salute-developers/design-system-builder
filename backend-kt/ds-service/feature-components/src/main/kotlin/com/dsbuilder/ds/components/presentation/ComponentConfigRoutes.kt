package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentConfigQuery
import com.dsbuilder.ds.components.application.ExportComponentConfig
import com.dsbuilder.ds.components.application.ExportComponentConfigUseCase
import com.dsbuilder.ds.components.application.GetComponentConfigUseCase
import com.dsbuilder.ds.components.application.GetComponentWebAdapterUseCase
import com.dsbuilder.ds.components.application.ImportComponentConfigUseCase
import com.dsbuilder.ds.components.domain.ComponentConfigImportResult
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.ErrorResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.request.receiveChannel
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.utils.io.readAvailable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream

/** Registers the legacy-compatible single, import, export and web-adapter component-config routes. */
@Suppress("ComplexCondition", "CyclomaticComplexMethod", "LongMethod")
fun Route.componentConfigRoutes(
    evaluator: PolicyEvaluator,
    getConfig: GetComponentConfigUseCase,
    importConfig: ImportComponentConfigUseCase,
    exportConfig: ExportComponentConfigUseCase,
    getWebAdapter: GetComponentWebAdapterUseCase,
    json: Json,
) {
    route("/api/ds/component-config") {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val query = call.request.queryParameters
            val designSystem = query["ds"]
            val version = query["version"]
            val appearance = query["appearance"]
            val component = query["component"]
            val platform = query["platform"]
            if (
                designSystem == null || version == null || appearance == null || component == null ||
                platform == null || platform !in componentPlatforms
            ) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_query"))
            }
            when (
                val result = getConfig.execute(
                    context,
                    ComponentConfigQuery(designSystem, version, appearance, component, platform),
                )
            ) {
                is DsResult.Success -> call.respondSuccess(result, ComponentConfigResponse.single(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }

        post("/export") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<ExportComponentConfigRequest>()
            val id = request.designSystemId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                request.platform !in componentPlatforms ||
                request.components.orEmpty().any(String::isEmpty) || request.styles.orEmpty().any(String::isEmpty)
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            when (
                val result = exportConfig.execute(
                    context,
                    ExportComponentConfig(id, request.platform, request.components, request.styles),
                )
            ) {
                is DsResult.Success -> call.respondSuccess(result, ExportComponentConfigResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }

        // Временная ручка рядом с `/export`: адресация та же, а ответ CLI сохраняет как есть
        // в `.sdds/web/web-adapter.json`.
        post("/web-adapter") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val id = runCatching { call.receive<ComponentWebAdapterRequest>() }.getOrNull()
                ?.designSystemId?.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = getWebAdapter.execute(context, id)) {
                is DsResult.Success -> call.respond(result.value.map(ComponentWebAdapterEntryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }

        post("/import") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val body = call.receiveAtMost(COMPONENT_CONFIG_IMPORT_LIMIT_BYTES)
            if (body == null) {
                return@post call.respond(HttpStatusCode.PayloadTooLarge, ErrorResponse("Payload too large"))
            }
            val request = runCatching {
                Json.decodeFromString<ImportComponentConfigRequest>(body.toString(Charsets.UTF_8))
            }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val id = request.designSystemId.toUuidOrNull()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            if (
                request.platform !in componentPlatforms || request.components.isEmpty() ||
                request.components.any { it.componentName.isEmpty() || it.styleName.isEmpty() }
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            when (
                val result = importConfig.execute(
                    context.withIdempotentResponse { value: ComponentConfigImportResult ->
                        json.encodeToString(ImportComponentConfigResponse.from(value))
                    },
                    request.toCommand(id),
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(result, ImportComponentConfigResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

internal suspend fun ApplicationCall.receiveAtMost(limit: Int): ByteArray? {
    val channel = receiveChannel()
    val output = ByteArrayOutputStream(minOf(limit, 64 * 1024))
    val buffer = ByteArray(8192)
    while (true) {
        val count = channel.readAvailable(buffer)
        if (count == -1) return output.toByteArray()
        if (count == 0) continue
        if (output.size() + count > limit) return null
        output.write(buffer, 0, count)
    }
}

internal const val COMPONENT_CONFIG_IMPORT_LIMIT_BYTES = 16 * 1024 * 1024
