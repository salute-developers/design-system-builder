package com.dsbuilder.ds.core.presentation

import com.dsbuilder.ds.core.application.DsFailure
import io.ktor.server.application.ApplicationCall
import java.util.UUID

/** Проверяет ограниченный список токенов; отсутствие фильтра сохраняет полную выдачу. */
suspend fun ApplicationCall.tokenIdFilter(): Set<UUID>? {
    val parameters = request.queryParameters.getAll("tokenIds") ?: return emptySet()
    val raw = parameters.singleOrNull()?.split(',')
    val ids = raw?.mapNotNull { text ->
        runCatching { UUID.fromString(text) }.getOrNull()?.takeIf { it.toString() == text.lowercase() }
    }
    if (raw == null || raw.size !in 1..200 || ids?.size != raw.size) {
        respondFailure(DsFailure.InvalidRequest("invalid_token_ids"))
        return null
    }
    return ids.toSet()
}
