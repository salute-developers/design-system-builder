package com.dsbuilder.ds.core.presentation

import com.dsbuilder.ds.core.application.DsResult
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond

/** Возвращает обычное предметное тело и технические метаданные изменения в отдельном заголовке. */
suspend inline fun <reified T : Any> ApplicationCall.respondSuccess(result: DsResult.Success<*>, message: T) {
    appendMutationMetadata(result.mutationMetadata)
    appendReadContext(result.readContext)
    appendReadPage(result.readPage)
    respond(message)
}

/** Вариант [respondSuccess] с явным HTTP-статусом. */
suspend inline fun <reified T : Any> ApplicationCall.respondSuccess(
    result: DsResult.Success<*>,
    status: HttpStatusCode,
    message: T,
) {
    appendMutationMetadata(result.mutationMetadata)
    appendReadContext(result.readContext)
    appendReadPage(result.readPage)
    respond(status, message)
}
