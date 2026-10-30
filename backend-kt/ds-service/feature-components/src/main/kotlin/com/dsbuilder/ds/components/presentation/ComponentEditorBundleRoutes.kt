package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.GetComponentEditorBundleUseCase
import com.dsbuilder.ds.components.domain.ComponentEditorPlatform
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route

/**
 * Регистрирует `GET /api/ds/design-systems/{designSystemId}/components/{componentId}/editor-bundle`:
 * данные одного компонента для редактора одним запросом.
 *
 * `platform` обязателен (`web` или `compose`), иначе `400`; `versionId` выбирает опубликованную версию.
 */
fun Route.componentEditorBundleRoutes(evaluator: PolicyEvaluator, bundle: GetComponentEditorBundleUseCase) {
    route("/api/ds/design-systems") {
        get("/{designSystemId}/components/{componentId}/editor-bundle") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            ) ?: return@get call.respondFailure(DsFailure.Forbidden)
            val designSystemId = call.parameters["designSystemId"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_design_system_id"))
            val componentId = call.parameters["componentId"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_component_id"))
            val platform = ComponentEditorPlatform.fromWire(call.request.queryParameters["platform"])
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_platform"))
            when (val result = bundle.execute(context, designSystemId, componentId, platform)) {
                is DsResult.Success -> call.respondSuccess(result, ComponentEditorBundleResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
