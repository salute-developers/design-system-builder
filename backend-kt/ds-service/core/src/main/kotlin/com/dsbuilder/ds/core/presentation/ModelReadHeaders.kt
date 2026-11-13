package com.dsbuilder.ds.core.presentation

import com.dsbuilder.ds.core.application.ModelReadContext
import com.dsbuilder.ds.core.application.ModelReadPage
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.header
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Передаёт только разрешённые метаданные фактического чтения. */
@PublishedApi
internal fun ApplicationCall.appendReadContext(context: ModelReadContext?) {
    if (context == null) return
    response.header(
        "X-DS-Read-Context",
        coreReadContextJson(context).toString(),
    )
}

/** Сохраняет массив в теле, передавая продолжение отдельно. */
@PublishedApi
internal fun ApplicationCall.appendReadPage(page: ModelReadPage?) {
    if (page == null) return
    response.header("X-DS-Page-Limit", page.limit.toString())
    page.nextCursor?.let { response.header("X-DS-Next-Cursor", it) }
}

/** Представление контекста одинаково в метаданных чтения и отказе совместимости. */
internal fun coreReadContextJson(context: ModelReadContext) = buildJsonObject {
    put("designSystemId", context.designSystemId.toString())
    context.version?.let { put("version", it) }
    context.versionId?.let { put("versionId", it.toString()) }
    context.draftId?.let { put("draftId", it.toString()) }
    context.draftRevision?.let { put("draftRevision", it) }
    if (context.versionId != null || context.draftId != null) {
        put(
            "coreReleases",
            JsonArray(
                context.coreReleases.map { release ->
                    buildJsonObject {
                        put("releaseId", release.releaseId.toString())
                        put("libraryId", release.ref.libraryId)
                        put("platform", release.ref.platform)
                        put("version", release.ref.version)
                        release.metaSha256?.let { put("metaSha256", it) }
                        put("provenance", release.provenance)
                    }
                },
            ),
        )
    }
}
