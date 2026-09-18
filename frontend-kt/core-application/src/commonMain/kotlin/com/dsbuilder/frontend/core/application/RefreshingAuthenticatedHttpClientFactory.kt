package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResponse
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.MultipartFile

/** Retries a Bearer request once after a typed HTTP 401 with a refreshed user session. */
internal class RefreshingAuthenticatedHttpClientFactory(
    private val delegate: AuthenticatedHttpClientFactory,
    private val credentialProvider: CredentialProvider,
    private val credentialStore: CredentialStore,
) : AuthenticatedHttpClientFactory {
    override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
        create(apiUrl, BackendCredential.ProjectKey(apiKey))

    override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient =
        RefreshingClient(apiUrl, credential)

    private inner class RefreshingClient(
        private val apiUrl: String,
        private val credential: BackendCredential,
    ) : AuthenticatedHttpClient {
        private val firstClient = delegate.create(apiUrl, credential)

        override suspend fun get(path: String): AuthenticatedHttpResult =
            retryResult(firstClient.get(path)) { it.get(path) }

        override suspend fun post(path: String, body: String): AuthenticatedHttpResult =
            retryResult(firstClient.post(path, body)) { it.post(path, body) }

        override suspend fun postMultipart(path: String, file: MultipartFile): AuthenticatedHttpResponse {
            val first = firstClient.postMultipart(path, file)
            return if (first.statusCode == 401) {
                refreshedClient()?.postMultipart(path, file)?.also { second ->
                    if (second.statusCode == 401) credentialStore.delete(apiUrl)
                } ?: first
            } else {
                first
            }
        }

        private suspend fun retryResult(
            first: AuthenticatedHttpResult,
            retry: suspend (AuthenticatedHttpClient) -> AuthenticatedHttpResult,
        ): AuthenticatedHttpResult =
            if (first is AuthenticatedHttpResult.Failure && first.statusCode == 401) {
                refreshedClient()?.let { client ->
                    retry(client).also { second ->
                        if (second is AuthenticatedHttpResult.Failure && second.statusCode == 401) {
                            credentialStore.delete(apiUrl)
                        }
                    }
                } ?: first
            } else {
                first
            }

        private suspend fun refreshedClient(): AuthenticatedHttpClient? {
            if (credential !is BackendCredential.Bearer) return null
            val result = credentialProvider.resolve(
                CredentialRequest(
                    apiUrl = ProjectApiUrl(apiUrl),
                    credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
                    policy = CredentialPolicy.USER_SESSION,
                ),
            )
            val refreshed = (result as? CredentialResult.Selected)?.credential as? BackendCredential.Bearer
                ?: return null
            return delegate.create(apiUrl, refreshed)
        }
    }
}
