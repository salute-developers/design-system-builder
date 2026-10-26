package com.dsbuilder.ds.core.presentation

import com.dsbuilder.ds.core.application.ModelReadContext
import com.dsbuilder.ds.core.application.ModelReadPage
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.header
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Передаёт только разрешённые метаданные фактического чтения. */
@PublishedApi
internal fun ApplicationCall.appendReadContext(context: ModelReadContext?) {
    if (context == null) return
    response.header(
        "X-DS-Read-Context",
        buildJsonObject {
            put("designSystemId", context.designSystemId.toString())
            context.version?.let { put("version", it) }
            context.versionId?.let { put("versionId", it.toString()) }
            context.draftId?.let { put("draftId", it.toString()) }
            context.draftRevision?.let { put("draftRevision", it) }
        }.toString(),
    )
}

/** Сохраняет массив в теле, передавая продолжение отдельно. */
@PublishedApi
internal fun ApplicationCall.appendReadPage(page: ModelReadPage?) {
    if (page == null) return
    response.header("X-DS-Page-Limit", page.limit.toString())
    page.nextCursor?.let { response.header("X-DS-Next-Cursor", it) }
}
