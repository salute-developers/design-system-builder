package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.INTERACTIVE_CLIENT_ID
import com.dsbuilder.frontend.core.auth.MissingApiKeyException
import com.dsbuilder.frontend.core.auth.RotatingCredentialStore
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.TokenResponse
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

/**
 * Selects project key first, then user session for the resolved backend API URL.
 */
internal class RuntimeCredentialProvider(
    private val apiKeyResolver: ApiKeyResolver,
    private val credentialStore: CredentialStore,
    private val tokenClient: TokenClient,
    private val nowMillis: () -> Long = ::systemNowMillis,
    private val cache: com.dsbuilder.frontend.core.auth.UserAccessTokenCache =
        com.dsbuilder.frontend.core.auth.UserAccessTokenCache(),
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
        if (policy == CredentialPolicy.USER_SESSION) {
            return resolveSessionCredential(
                apiUrl,
                request.forceRefresh,
                request.rejectedAccessToken,
            )
        }
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
        } ?: resolveSessionCredential(apiUrl, request.forceRefresh, request.rejectedAccessToken)
    }

    private fun resolveProjectKey(
        projectKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
        projectEnvironment: EnvironmentReader?,
    ) = try {
        apiKeyResolver.resolve(projectKeyOverride, credentialEnvName.value, projectEnvironment)
    } catch (_: MissingApiKeyException) {
        null
    }

    private suspend fun resolveSessionCredential(
        apiUrl: ProjectApiUrl,
        forceRefresh: Boolean,
        rejectedAccessToken: String?,
    ): CredentialResult =
        cache.withSessionLock {
            val session = credentialStore.read(apiUrl.value)
            if (session == null || !isCompatible(session, apiUrl.value)
            ) {
                cache.clear(apiUrl.value)
                return@withSessionLock CredentialResult.Failed(
                    AuthErrorCode.AUTH_REQUIRED,
                    "Error: authentication is required. Run auth login for browser authentication.",
                )
            }
            val cached = cache.current(session, nowMillis())
            val refreshedByAnotherRequest = rejectedAccessToken != null && cached != rejectedAccessToken
            if (cached != null && (!forceRefresh || refreshedByAnotherRequest)) {
                return@withSessionLock CredentialResult.Selected(
                    BackendCredential.Bearer(cached),
                    BackendCredentialType.USER_SESSION,
                )
            }
            refreshSession(apiUrl, session)
        }

    private fun isCompatible(session: UserSession, apiUrl: String): Boolean =
        session.apiUrl == apiUrl && session.schemaVersion == 2 && session.clientId == INTERACTIVE_CLIENT_ID

    private suspend fun refreshSession(
        apiUrl: ProjectApiUrl,
        session: UserSession,
    ): CredentialResult {
        var currentSession = session
        val refreshed = if (credentialStore is RotatingCredentialStore) {
            credentialStore.refreshSession(apiUrl.value) { lockedSession ->
                currentSession = lockedSession
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
        return refreshed.toCredentialResult(apiUrl, currentSession)
    }

    private suspend fun AuthResult<TokenResponse>.toCredentialResult(
        apiUrl: ProjectApiUrl,
        session: UserSession,
    ): CredentialResult =
        when (this) {
            is AuthResult.Failed -> {
                if (code == AuthErrorCode.AUTH_REQUIRED && credentialStore !is RotatingCredentialStore) {
                    credentialStore.delete(apiUrl.value)
                }
                cache.clear(apiUrl.value)
                CredentialResult.Failed(code, message)
            }
            is AuthResult.Success -> {
                cache.put(session, value, nowMillis())
                CredentialResult.Selected(
                    credential = BackendCredential.Bearer(value.accessToken),
                    type = BackendCredentialType.USER_SESSION,
                )
            }
        }
}

@OptIn(ExperimentalTime::class)
private fun systemNowMillis(): Long = Clock.System.now().toEpochMilliseconds()
