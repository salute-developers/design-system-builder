package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ListCoreReleasesUseCase
import com.dsbuilder.ds.components.application.ReadCoreSettingsUseCase
import com.dsbuilder.ds.components.application.SelectCoreRelease
import com.dsbuilder.ds.components.application.SelectCoreReleaseUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondResult
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.server.request.receiveText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.put
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID

/** Чтение выбора и каталога, атомарное сохранение одной платформы обычной ДС. */
fun Route.coreSettingsRoutes(
    evaluator: PolicyEvaluator,
    listReleases: ListCoreReleasesUseCase,
    selectRelease: SelectCoreReleaseUseCase,
    report: ReadCoreSettingsUseCase,
    json: Json,
) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/core-settings")) {
        val params = call.request.queryParameters
        val context = TrustedDsRequestContextMapper.map(call.dsTrustedHeaders(), evaluator, params["versionId"])
            ?: return@get call.respondFailure(DsFailure.Forbidden)
        call.respondResult(
            report.execute(context.copy(version = params["version"])),
            transform = CoreSettingsResponse::from,
        )
    }
    coreReleaseCatalogRoute(evaluator, listReleases)
    coreSelectionRoute(evaluator, selectRelease, json)
}

private fun Route.coreReleaseCatalogRoute(evaluator: PolicyEvaluator, listReleases: ListCoreReleasesUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/core-releases")) {
        val params = call.request.queryParameters
        val context = TrustedDsRequestContextMapper.map(call.dsTrustedHeaders(), evaluator, params["versionId"])
            ?: return@get call.respondFailure(DsFailure.Forbidden)
        val offset = params["offset"]?.toIntOrNull() ?: if (params["offset"] == null) 0 else -1
        val limit = params["limit"]?.toIntOrNull() ?: if (params["limit"] == null) 50 else -1
        when (
            val result = listReleases.execute(
                context.copy(version = params["version"]),
                params["platform"].orEmpty(),
                params["channel"].orEmpty(),
                offset,
                limit,
            )
        ) {
            is DsResult.Failure -> call.respondFailure(result.error)
            is DsResult.Success -> call.respondSuccess(
                result,
                result.value.map { release ->
                    CoreCompatibilityResponse.Release(
                        release.releaseId.toString(),
                        release.ref.libraryId,
                        release.ref.platform,
                        release.ref.version,
                        release.metaSha256,
                        release.provenance,
                        release.channel,
                    )
                },
            )
        }
    }
}

private fun Route.coreSelectionRoute(
    evaluator: PolicyEvaluator,
    selectRelease: SelectCoreReleaseUseCase,
    json: Json,
) {
    put(dsRoutePath("/api/design-systems/{designSystemId}/core-settings/{platform}")) {
        val params = call.request.queryParameters
        val context = TrustedDsRequestContextMapper.map(call.dsTrustedHeaders(), evaluator, params["versionId"])
            ?: return@put call.respondFailure(DsFailure.Forbidden)
        val command = runCatching {
            val body = json.decodeFromString<SelectCoreRequest>(call.receiveText())
            SelectCoreRelease(
                call.parameters["platform"].orEmpty(), body.channel,
                body.releaseId?.let(UUID::fromString), UUID.fromString(body.expectedDraftId),
                body.expectedCoreSelectionRevision, body.selectionMode,
            )
        }.getOrNull() ?: return@put call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
        call.respondResult(
            selectRelease.execute(context.copy(version = params["version"]), command),
            transform = CoreSettingsResponse::from,
        )
    }
}

/** Полная пара выбора и ожидаемый контекст черновика. */
@Serializable
private data class SelectCoreRequest(
    val channel: String,
    val releaseId: String? = null,
    val expectedDraftId: String,
    val expectedCoreSelectionRevision: Long,
    val selectionMode: String = "pinned",
)
