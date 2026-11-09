package com.dsbuilder.frontend.core.network

import kotlinx.coroutines.CancellationException

/** Перечитывает доступные редакции после подтверждённой записи с усечёнными метаданными. */
@Suppress("TooGenericExceptionCaught")
public suspend fun AuthenticatedHttpClient.confirmTruncatedMutation(
    result: HttpMutationResult,
    paths: List<String>,
): HttpMutationResult {
    if (result !is HttpMutationResult.Response || result.statusCode !in 200..299) return result
    if (result.metadataValid && result.headers["x-ds-mutation-metadata-truncated"] != "true") return result
    val reads = mutableMapOf<String, String>()
    var incomplete = paths.isEmpty()
    for (path in paths) {
        try {
            when (val response = get(path)) {
                is AuthenticatedHttpResult.Success -> reads[path] = response.body
                is AuthenticatedHttpResult.Failure -> incomplete = true
            }
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            incomplete = true
        }
    }
    return result.copy(confirmedReads = reads, confirmationAttempted = true, confirmationIncomplete = incomplete)
}
