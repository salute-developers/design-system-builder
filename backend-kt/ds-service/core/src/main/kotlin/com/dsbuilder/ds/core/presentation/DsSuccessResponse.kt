package com.dsbuilder.ds.core.presentation

import com.dsbuilder.ds.core.application.DsResult
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.header
import io.ktor.server.response.respond

/** Возвращает обычное предметное тело и технические метаданные изменения в отдельном заголовке. */
suspend fun ApplicationCall.respondSuccess(result: DsResult.Success<*>, message: Any) {
    result.mutationMetadata?.let { response.header(MUTATION_METADATA_HEADER, it) }
    respond(message)
}

/** Вариант [respondSuccess] с явным HTTP-статусом. */
suspend fun ApplicationCall.respondSuccess(
    result: DsResult.Success<*>,
    status: HttpStatusCode,
    message: Any,
) {
    result.mutationMetadata?.let { response.header(MUTATION_METADATA_HEADER, it) }
    respond(status, message)
}

private const val MUTATION_METADATA_HEADER = "X-DS-Mutation-Metadata"
