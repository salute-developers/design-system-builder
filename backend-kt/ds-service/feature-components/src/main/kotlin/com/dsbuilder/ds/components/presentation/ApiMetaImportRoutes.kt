package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ImportApiMetaUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.ErrorResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json

private val lenientJson = Json { ignoreUnknownKeys = true }

/**
 * Registers the administrative API-meta import.
 *
 * The operation is global: the layer it writes is shared by every design system of every project, so only
 * a trusted system administrator may call it. The gateway accepts a user token only on this route.
 */
fun Route.apiMetaImportRoutes(evaluator: PolicyEvaluator, importApiMeta: ImportApiMetaUseCase) {
    route("/api/ds/admin/component-config") {
        post("/import-api-meta") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            // The role is checked before the body is read: a caller who is refused anyway gets nothing parsed.
            if (!context.principal.systemAdmin) return@post call.respondFailure(DsFailure.Forbidden)
            val body = call.receiveAtMost(COMPONENT_CONFIG_IMPORT_LIMIT_BYTES)
                ?: return@post call.respond(HttpStatusCode.PayloadTooLarge, ErrorResponse("Payload too large"))
            val request = runCatching {
                lenientJson.decodeFromString<ImportApiMetaRequest>(body.toString(Charsets.UTF_8))
            }.getOrNull()?.takeIf(ImportApiMetaRequest::valid)
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = importApiMeta.execute(context, request.toCommand())) {
                is DsResult.Success -> call.respond(ImportApiMetaResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
