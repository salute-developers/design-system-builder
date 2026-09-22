package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.MissingApiKeyException
import com.dsbuilder.frontend.core.auth.RotatingCredentialStore
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl

/**
 * Selects project key first, then user session for the resolved backend API URL.
 */
internal class RuntimeCredentialProvider(
    private val apiKeyResolver: ApiKeyResolver,
    private val credentialStore: CredentialStore,
    private val tokenClient: TokenClient,
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

    override suspend fun resolve(request: CredentialRequest): CredentialResult {
        val apiUrl = request.apiUrl
        val projectKeyOverride = request.projectKeyOverride
        val credentialEnvName = request.credentialEnvName
        val policy = request.policy
        if (policy == CredentialPolicy.USER_SESSION) return resolveSessionCredential(apiUrl)
        val key = resolveProjectKey(projectKeyOverride, credentialEnvName, request.projectEnvironment)
        if (key == null && policy == CredentialPolicy.PROJECT_KEY_ENV) {
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
        } ?: resolveSessionCredential(apiUrl)
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
