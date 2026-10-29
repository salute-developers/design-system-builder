package com.dsbuilder.ds.core.presentation

import com.dsbuilder.ds.core.application.IdempotentResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.header
import io.ktor.server.response.respondText

/** Воспроизводит исходный ответ; прежний результат без метаданных явно требует сверки данных. */
suspend fun ApplicationCall.respondIdempotentReplay(result: IdempotentResponse) {
    appendMutationMetadata(result.mutationMetadata)
    if (!result.mutationMetadataCaptured) {
        response.header("X-DS-Mutation-Metadata", "[]")
        response.header("X-DS-Mutation-Metadata-Truncated", "true")
    }
    respondText(result.body, ContentType.Application.Json, HttpStatusCode.fromValue(result.status))
}
