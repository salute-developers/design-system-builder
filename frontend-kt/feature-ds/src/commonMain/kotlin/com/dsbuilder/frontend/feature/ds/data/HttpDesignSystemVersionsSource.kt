package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.ds.application.DesignSystemVersionsSource
import com.dsbuilder.frontend.feature.ds.application.DiscoverDesignSystemVersionsCommand
import com.dsbuilder.frontend.feature.ds.application.ModelReadCommand
import com.dsbuilder.frontend.feature.ds.application.ModelReadOperation
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult

internal class HttpDesignSystemVersionsSource(
    private val clients: AuthenticatedHttpClientFactory,
) : DesignSystemVersionsSource {
    override suspend fun read(
        apiUrl: String,
        credential: BackendCredential,
        command: DiscoverDesignSystemVersionsCommand,
    ): ModelReadResult {
        val read = ModelReadCommand(ModelReadOperation.VERSIONS, limit = command.limit, cursor = command.cursor)
        val request = ModelReadHttpRequest.create(command.projectId, command.designSystemId, read)
        return when (val response = clients.create(apiUrl, credential).get(request.url)) {
            is AuthenticatedHttpResult.Failure -> modelReadFailure(response.statusCode, credential)
            is AuthenticatedHttpResult.Success -> ModelReadResponseDecoder.decode(
                response,
                read,
                request.paged,
                request.limit,
            )
        }
    }
}
