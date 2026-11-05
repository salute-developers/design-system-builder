package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ListComponentTemplatesUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/** Регистрирует маршрут шаблонов компонентов; добавление из шаблона — `POST /design-system-components`. */
fun Route.componentTemplateRoutes(
    evaluator: PolicyEvaluator,
    list: ListComponentTemplatesUseCase,
) {
    get(dsRoutePath("/api/ds/component-templates")) {
        val context = TrustedDsRequestContextMapper.map(
            call.dsTrustedHeaders(),
            evaluator,
            call.request.queryParameters["versionId"],
        ) ?: return@get call.respondFailure(DsFailure.Forbidden)
        when (val result = list.execute(context)) {
            is DsResult.Success -> call.respondSuccess(result, result.value.map(ComponentTemplateResponse::from))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}
