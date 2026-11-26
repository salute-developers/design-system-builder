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

/** Преобразует успешное значение use case в HTTP DTO, сохраняя общую обработку отказа и метаданных. */
suspend inline fun <V, reified R : Any> ApplicationCall.respondResult(
    result: DsResult<V>,
    status: HttpStatusCode = HttpStatusCode.OK,
    transform: (V) -> R,
) {
    when (result) {
        is DsResult.Success -> respondSuccess(result, status, transform(result.value))
        is DsResult.Failure -> respondFailure(result.error)
    }
}
