package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.UserAccessTokenCache
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
    private val cache: UserAccessTokenCache = UserAccessTokenCache(),
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
            if (first.statusCode != 401 || credential !is BackendCredential.Bearer) return first
            return when (val refreshed = refreshedClient()) {
                is AuthResult.Failed -> AuthenticatedHttpResponse(errorStatus(refreshed.code), refreshed.message)
                is AuthResult.Success -> refreshed.value.postMultipart(path, file).also { second ->
                    if (second.statusCode == 401) clearSession()
                }
            }
        }

        private suspend fun retryResult(
            first: AuthenticatedHttpResult,
            retry: suspend (AuthenticatedHttpClient) -> AuthenticatedHttpResult,
        ): AuthenticatedHttpResult {
            if (first !is AuthenticatedHttpResult.Failure || first.statusCode != 401) return first
            if (credential !is BackendCredential.Bearer) return first
            return when (val refreshed = refreshedClient()) {
                is AuthResult.Failed -> AuthenticatedHttpResult.Failure(refreshed.message, errorStatus(refreshed.code))
                is AuthResult.Success -> retry(refreshed.value).also { second ->
                    if (second is AuthenticatedHttpResult.Failure && second.statusCode == 401) clearSession()
                }
            }
        }

        private suspend fun clearSession() = cache.withSessionLock {
            credentialStore.delete(apiUrl)
            cache.clear(apiUrl)
        }

        private suspend fun refreshedClient(): AuthResult<AuthenticatedHttpClient> {
            val result = credentialProvider.resolve(
                CredentialRequest(
                    apiUrl = ProjectApiUrl(apiUrl),
                    credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
                    policy = CredentialPolicy.USER_SESSION,
                    forceRefresh = true,
                    rejectedAccessToken = (credential as? BackendCredential.Bearer)?.accessToken,
                ),
            )
            return when (result) {
                is CredentialResult.Failed -> AuthResult.Failed(result.code, result.message)
                is CredentialResult.Selected -> AuthResult.Success(delegate.create(apiUrl, result.credential))
            }
        }
    }

    private fun errorStatus(code: AuthErrorCode): Int = when (code) {
        AuthErrorCode.AUTH_REQUIRED, AuthErrorCode.PROJECT_KEY_INVALID -> 401
        AuthErrorCode.FORBIDDEN -> 403
        else -> 503
    }
}
