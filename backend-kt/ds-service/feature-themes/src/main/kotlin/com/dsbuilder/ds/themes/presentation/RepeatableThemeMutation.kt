package com.dsbuilder.ds.themes.presentation

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.IdempotentMutationRequest
import com.dsbuilder.ds.core.application.withIdempotentResponse
import io.ktor.http.HttpMethod
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import kotlinx.serialization.json.Json

/** Связывает ключ с разобранным запросом и точным ответом без повторной предметной записи. */
internal inline fun <T : Any, reified R> ApplicationCall.repeatableThemeMutation(
    context: DsRequestContext,
    body: Any?,
    status: Int = 200,
    crossinline response: (T) -> R,
): DsRequestContext {
    // Как в ADR: обычное автосохранение PUT/PATCH/DELETE не увеличивает таблицу результатов запросов.
    if (request.httpMethod != HttpMethod.Post) return context
    val key = request.headers["Idempotency-Key"] ?: return context
    return context.copy(
        mutationRequest = IdempotentMutationRequest(
            key,
            "${request.httpMethod.value} ${request.path()}",
            body,
            status,
        ),
    ).withIdempotentResponse<T> { Json.encodeToString(response(it)) }
}
