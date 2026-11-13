package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.GetCoreCompatibilityUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import java.util.UUID

/** Системный отчёт использует прежние селекторы DS/version и права чтения компонентов. */
fun Route.coreCompatibilityRoutes(evaluator: PolicyEvaluator, useCase: GetCoreCompatibilityUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/compatibility")) {
        val context = TrustedDsRequestContextMapper.map(
            call.dsTrustedHeaders(), evaluator,
            call.request.queryParameters["versionId"],
        )
            ?: return@get call.respondFailure(DsFailure.Forbidden)
        val params = call.request.queryParameters
        val component = params["componentId"]?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        val limit = params["limit"]?.toIntOrNull() ?: if (params["limit"] == null) 100 else 0
        if (params["componentId"] != null && component == null) {
            return@get call.respondFailure(DsFailure.InvalidRequest("invalid_query"))
        }
        val query = GetCoreCompatibilityUseCase.Query(component, params["severity"], limit, params["cursor"])
        when (val result = useCase.execute(context.copy(version = params["version"]), query)) {
            is DsResult.Failure -> call.respondFailure(result.error)
            is DsResult.Success -> call.respondSuccess(result, CoreCompatibilityResponse.from(result.value))
        }
    }
}
