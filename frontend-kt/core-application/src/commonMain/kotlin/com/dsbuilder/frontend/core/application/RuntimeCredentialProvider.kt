package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.MissingApiKeyException
import com.dsbuilder.frontend.core.auth.RotatingCredentialStore
import com.dsbuilder.frontend.core.auth.SERVICE_ACCOUNT_CLIENT_ID_ENV
import com.dsbuilder.frontend.core.auth.SERVICE_ACCOUNT_CLIENT_SECRET_ENV
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl

/**
 * Selects project key first, then user session for the resolved backend API URL.
 *
 * The [CredentialPolicy.SERVICE_ACCOUNT_OR_USER_SESSION] policy first looks for a service account in the
 * environment (`DSBUILDER_CLIENT_ID` and `DSBUILDER_CLIENT_SECRET`) and only then at the saved user session.
 */
internal class RuntimeCredentialProvider(
    private val apiKeyResolver: ApiKeyResolver,
    private val credentialStore: CredentialStore,
    private val tokenClient: TokenClient,
    private val environment: EnvironmentReader = EnvironmentReader { null },
) : CredentialProvider {
    override suspend fun resolve(
        apiUrl: ProjectApiUrl,
        projectKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
    ): CredentialResult = resolve(
        CredentialRequest(apiUrl, projectKeyOverride, credentialEnvName, CredentialPolicy.AUTO),
    )

    override suspend fun resolve(
        apiUrl: ProjectApiUrl,
        projectKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
        policy: CredentialPolicy,
    ): CredentialResult = resolve(CredentialRequest(apiUrl, projectKeyOverride, credentialEnvName, policy))

    override suspend fun resolve(request: CredentialRequest): CredentialResult = when (request.policy) {
        CredentialPolicy.USER_SESSION -> resolveSessionCredential(request.apiUrl)
        CredentialPolicy.SERVICE_ACCOUNT_OR_USER_SESSION -> resolveServiceOrSession(request.apiUrl)
        CredentialPolicy.AUTO, CredentialPolicy.PROJECT_KEY_ENV -> resolveProjectKeyOrSession(request)
    }

    private suspend fun resolveProjectKeyOrSession(request: CredentialRequest): CredentialResult {
        val credentialEnvName = request.credentialEnvName
        val key = resolveProjectKey(request.projectKeyOverride, credentialEnvName, request.projectEnvironment)
        if (key == null && request.policy == CredentialPolicy.PROJECT_KEY_ENV) {
            return CredentialResult.Failed(
                AuthErrorCode.AUTH_REQUIRED,
                "Error: project key is required from ${credentialEnvName.value}.",
            )
        }
        return key?.let { projectKey ->
            CredentialResult.Selected(
                credential = BackendCredential.ProjectKey(projectKey.value),
                type = BackendCredentialType.PROJECT_KEY,
            )
        } ?: resolveSessionCredential(request.apiUrl)
    }

    private suspend fun resolveServiceOrSession(apiUrl: ProjectApiUrl): CredentialResult {
        val clientId = environment.get(SERVICE_ACCOUNT_CLIENT_ID_ENV)?.takeIf(String::isNotBlank)
        val clientSecret = environment.get(SERVICE_ACCOUNT_CLIENT_SECRET_ENV)?.takeIf(String::isNotBlank)
        if (clientId == null && clientSecret == null) return resolveSessionCredential(apiUrl)
        if (clientId == null || clientSecret == null) {
            return CredentialResult.Failed(
                AuthErrorCode.AUTH_REQUIRED,
                "Error: set both $SERVICE_ACCOUNT_CLIENT_ID_ENV and $SERVICE_ACCOUNT_CLIENT_SECRET_ENV " +
                    "to sign in as a service account.",
            )
        }
        return when (val token = tokenClient.clientCredentials(apiUrl.value, clientId, clientSecret)) {
            is AuthResult.Failed -> CredentialResult.Failed(token.code, token.message)
            is AuthResult.Success -> CredentialResult.Selected(
                credential = BackendCredential.ServiceToken(token.value.accessToken),
                type = BackendCredentialType.SERVICE_ACCOUNT,
            )
        }
    }

    private fun resolveProjectKey(
        projectKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
        projectEnvironment: com.dsbuilder.frontend.core.auth.EnvironmentReader?,
    ) = try {
        apiKeyResolver.resolve(projectKeyOverride, credentialEnvName.value, projectEnvironment)
    } catch (_: MissingApiKeyException) {
        null
    }

    private suspend fun resolveSessionCredential(apiUrl: ProjectApiUrl): CredentialResult {
        val session = credentialStore.read(apiUrl.value)
        return when {
            session == null -> CredentialResult.Failed(
                AuthErrorCode.AUTH_REQUIRED,
                "Error: authentication is required.",
            )
            session.apiUrl != apiUrl.value -> CredentialResult.Failed(
                AuthErrorCode.AUTH_REQUIRED,
                "Error: stored session belongs to another API URL.",
            )
            else -> refreshSession(apiUrl, session)
        }
    }

    private suspend fun refreshSession(
        apiUrl: ProjectApiUrl,
        session: UserSession,
    ): CredentialResult {
        val refreshed = if (credentialStore is RotatingCredentialStore) {
            credentialStore.refreshSession(apiUrl.value) { lockedSession ->
                tokenClient.refresh(apiUrl.value, lockedSession.refreshToken)
            }
        } else {
            tokenClient.refresh(apiUrl.value, session.refreshToken).also { result ->
                if (result is AuthResult.Success) {
                    credentialStore.save(
                        session.copy(
                            refreshToken = result.value.refreshToken,
                            refreshExpiresAt = result.value.refreshExpiresAt,
                        ),
                    )
                }
            }
        }
        return refreshed.toCredentialResult(apiUrl)
    }

    private suspend fun AuthResult<com.dsbuilder.frontend.core.auth.TokenResponse>.toCredentialResult(
        apiUrl: ProjectApiUrl,
    ): CredentialResult =
        when (this) {
            is AuthResult.Failed -> {
                if (code == AuthErrorCode.AUTH_REQUIRED) {
                    credentialStore.delete(apiUrl.value)
                }
                CredentialResult.Failed(code, message)
            }
            is AuthResult.Success -> CredentialResult.Selected(
                credential = BackendCredential.Bearer(value.accessToken),
                type = BackendCredentialType.USER_SESSION,
            )
        }
}
