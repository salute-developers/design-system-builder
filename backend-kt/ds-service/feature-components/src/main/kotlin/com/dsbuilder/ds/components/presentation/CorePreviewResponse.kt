package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.GetCorePreviewUseCase
import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable

/** Адрес сборки с подтверждённым Core; отсутствие передаётся через 404. */
@Serializable
data class CorePreviewResponse(
    /** Идентификатор закреплённой или текущей совместимой сборки. */
    val buildId: String,
    /** URL файлов выбранной preview-сборки. */
    val pluginUrl: String,
    /** Core, которому принадлежит состав API и preview. */
    val coreRelease: CoreCompatibilityResponse.Release,
    /** SHA-256 исходных байтов; неизвестен у технического снимка миграции. */
    val metaSha256: String,
)

/** Системный путь выбирает сборку по DS/version, а не по глобальной активации платформы. */
fun Route.corePreviewRoutes(evaluator: PolicyEvaluator, useCase: GetCorePreviewUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/preview/{platform}")) {
        val context = TrustedDsRequestContextMapper.map(
            call.dsTrustedHeaders(), evaluator,
            call.request.queryParameters["versionId"],
        )
            ?: return@get call.respondFailure(DsFailure.Forbidden)
        val platform = PreviewPluginPlatform.entries.find { it.wire == call.parameters["platform"] }
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_platform"))
        when (val result = useCase.execute(platform, context.copy(version = call.request.queryParameters["version"]))) {
            is DsResult.Failure -> call.respondFailure(result.error)
            is DsResult.Success -> {
                val r = result.value.coreRelease
                val b = result.value.build
                call.respondSuccess(
                    result,
                    CorePreviewResponse(
                        b.build.buildId,
                        b.pluginUrl,
                        CoreCompatibilityResponse.Release(
                            r.releaseId.toString(),
                            r.ref.libraryId,
                            r.ref.platform,
                            r.ref.version,
                            r.metaSha256,
                            r.provenance,
                        ),
                        b.build.metaSha256,
                    ),
                )
            }
        }
    }
}
