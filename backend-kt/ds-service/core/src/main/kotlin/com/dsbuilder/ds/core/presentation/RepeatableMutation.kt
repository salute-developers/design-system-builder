package com.dsbuilder.ds.core.presentation

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.IdempotentMutationRequest
import com.dsbuilder.ds.core.application.withIdempotentResponse
import io.ktor.http.HttpMethod
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import kotlinx.serialization.json.Json

/** Связывает только изменяющую команду с ключом и кодировщиком исходного публичного ответа. */
inline fun <T : Any, reified R> ApplicationCall.repeatableMutation(
    context: DsRequestContext,
    body: Any?,
    status: Int = 200,
    json: Json = Json,
    crossinline response: (T) -> R,
): DsRequestContext {
    when (request.httpMethod) {
        HttpMethod.Post, HttpMethod.Put, HttpMethod.Patch, HttpMethod.Delete -> Unit
        else -> return context
    }
    val key = request.headers["Idempotency-Key"] ?: return context
    return context.copy(
        mutationRequest = IdempotentMutationRequest(key, "${request.httpMethod.value} ${request.path()}", body, status),
    ).withIdempotentResponse<T> { json.encodeToString(response(it)) }
}
