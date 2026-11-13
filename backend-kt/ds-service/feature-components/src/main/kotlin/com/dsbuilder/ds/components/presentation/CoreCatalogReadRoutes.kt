package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.GetComponentUseCase
import com.dsbuilder.ds.components.application.ListComponentDependenciesUseCase
import com.dsbuilder.ds.components.application.ListPropertiesUseCase
import com.dsbuilder.ds.components.application.ListPropertyPlatformParamsUseCase
import com.dsbuilder.ds.components.application.ListStatesUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.modelReadContext
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/** Читает описание API в выбранной границе ДС, сохраняя глобальный catalog отдельно. */
fun Route.coreComponentReadRoutes(evaluator: PolicyEvaluator, useCase: GetComponentUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/components/{id}")) {
        val context = call.modelReadContext(evaluator) ?: return@get
        val id = call.parameters["id"].toUuidOrNull()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        when (val result = useCase.execute(context, id)) {
            is DsResult.Success -> call.respondSuccess(result, ComponentResponse.from(result.value))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

/** Читает описание API в выбранной границе ДС, сохраняя глобальный catalog отдельно. */
fun Route.corePropertyReadRoutes(evaluator: PolicyEvaluator, useCase: ListPropertiesUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/properties")) {
        val context = call.modelReadContext(evaluator) ?: return@get
        when (val result = useCase.execute(context)) {
            is DsResult.Success -> call.respondSuccess(result, result.value.map(ComponentPropertySummaryResponse::from))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

/** Читает описание API в выбранной границе ДС, сохраняя глобальный catalog отдельно. */
fun Route.corePlatformParamReadRoutes(evaluator: PolicyEvaluator, useCase: ListPropertyPlatformParamsUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/property-platform-params")) {
        val context = call.modelReadContext(evaluator) ?: return@get
        when (val result = useCase.execute(context)) {
            is DsResult.Success -> call.respondSuccess(result, result.value.map(PropertyPlatformParamResponse::from))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

/** Читает описание API в выбранной границе ДС, сохраняя глобальный catalog отдельно. */
fun Route.coreDependencyReadRoutes(evaluator: PolicyEvaluator, useCase: ListComponentDependenciesUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/component-deps")) {
        val context = call.modelReadContext(evaluator) ?: return@get
        when (val result = useCase.execute(context)) {
            is DsResult.Success -> call.respondSuccess(result, result.value.map(ComponentDependencyResponse::from))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

/** Читает описание API в выбранной границе ДС, сохраняя глобальный catalog отдельно. */
fun Route.coreStateReadRoutes(evaluator: PolicyEvaluator, useCase: ListStatesUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/states")) {
        val context = call.modelReadContext(evaluator) ?: return@get
        val raw = call.request.queryParameters["componentId"]
        val componentId = if (raw == null || raw == "null") {
            null
        } else {
            raw.toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_component_id"))
        }
        when (val result = useCase.execute(context, componentId, raw != null)) {
            is DsResult.Success -> call.respondSuccess(result, result.value.map(ComponentStateResponse::from))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}
