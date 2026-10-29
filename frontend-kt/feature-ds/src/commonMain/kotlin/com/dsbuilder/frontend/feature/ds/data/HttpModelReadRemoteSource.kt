package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.ds.application.ModelReadCommand
import com.dsbuilder.frontend.feature.ds.application.ModelReadRemoteSource
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import com.dsbuilder.frontend.feature.ds.application.ModelReadRuntime

/** Читает модель через транспорт с выбранными credentials. */
internal class HttpModelReadRemoteSource(private val clients: AuthenticatedHttpClientFactory) : ModelReadRemoteSource {
    override suspend fun read(runtime: ModelReadRuntime, command: ModelReadCommand): ModelReadResult {
        val request = ModelReadHttpRequest.create(
            runtime.context.projectId.value,
            runtime.context.designSystemId.value,
            command,
        )
        return when (val response = clients.create(runtime.apiUrl, runtime.credential).get(request.url)) {
            is AuthenticatedHttpResult.Failure -> modelReadFailure(response.statusCode)
            is AuthenticatedHttpResult.Success -> ModelReadResponseDecoder.decode(
                response,
                command,
                request.paged,
                request.limit,
            )
        }
    }
}

private fun modelReadFailure(status: Int?): ModelReadResult.Failed = ModelReadResult.Failed(
    when (status) {
        400 -> "INVALID_QUERY"
        401 -> "AUTH_REQUIRED"
        403 -> "FORBIDDEN"
        404 -> "NOT_FOUND"
        else -> "BACKEND_UNAVAILABLE"
    },
    if (status == 401) {
        "Authentication required (HTTP 401). Run dsbuilder auth login and retry."
    } else {
        "Model read failed${status?.let { " (HTTP $it)" }.orEmpty()}."
    },
)
