package com.dsbuilder.frontend.core.network

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Сохраняет данные исходного чтения редактора и его безопасный HTTP-отказ. */
public suspend fun AuthenticatedHttpClient.editorReadResponse(
    path: String,
): HttpMutationResult.Response = when (val result = get(path)) {
    is AuthenticatedHttpResult.Success -> HttpMutationResult.Response(
        200,
        result.body,
        result.headers,
        result.readHeadersValid,
    )
    is AuthenticatedHttpResult.Failure -> HttpMutationResult.Response(
        result.statusCode ?: 503,
        buildJsonObject { put("message", "Backend editor read failed.") }.toString(),
        emptyMap(),
        true,
    )
}
