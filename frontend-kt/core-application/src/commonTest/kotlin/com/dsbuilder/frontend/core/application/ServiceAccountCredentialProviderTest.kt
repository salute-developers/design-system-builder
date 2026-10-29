package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AccessTokenResponse
import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.TokenResponse
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class ServiceAccountCredentialProviderTest {
    private val clientCalls = mutableListOf<Triple<String, String, String>>()
    private var sessionReads = 0
    private var clientResult: AuthResult<AccessTokenResponse> = AuthResult.Success(AccessTokenResponse("service-token"))

    private val tokenClient = object : TokenClient {
        override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
            AuthResult.Success(TokenResponse("user-access", "user-refresh", 999))

        override suspend fun logout(apiUrl: String, refreshToken: String): AuthResult<Unit> = error("unused")

        override suspend fun clientCredentials(
            apiUrl: String,
            clientId: String,
            clientSecret: String,
        ): AuthResult<AccessTokenResponse> {
            clientCalls += Triple(apiUrl, clientId, clientSecret)
            return clientResult
        }
    }

    private val store = object : CredentialStore {
        override suspend fun read(apiUrl: String): UserSession? {
            sessionReads++
            return UserSession(2, apiUrl, "admin", "refresh", 999, 1)
        }

        override suspend fun save(session: UserSession) = Unit

        override suspend fun delete(apiUrl: String) = Unit
    }

    private fun provider(env: Map<String, String>) = RuntimeCredentialProvider(
        apiKeyResolver = ApiKeyResolver(EnvironmentReader { null }),
        credentialStore = store,
        tokenClient = tokenClient,
        environment = EnvironmentReader { env[it] },
    )

    private suspend fun resolve(env: Map<String, String>) = provider(env).resolve(
        CredentialRequest(
            apiUrl = ProjectApiUrl("https://api.test"),
            credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
            policy = CredentialPolicy.SERVICE_ACCOUNT_OR_USER_SESSION,
        ),
    )

    @Test
    fun aServiceAccountFromTheEnvironmentGetsAServiceTokenWithoutTouchingTheSession() = runTest {
        val result = resolve(
            mapOf("DSBUILDER_CLIENT_ID" to "preview-publisher", "DSBUILDER_CLIENT_SECRET" to "s3cret"),
        )

        val selected = assertIs<CredentialResult.Selected>(result)
        assertEquals(BackendCredential.ServiceToken("service-token"), selected.credential)
        assertEquals(BackendCredentialType.SERVICE_ACCOUNT, selected.type)
        assertEquals(listOf(Triple("https://api.test", "preview-publisher", "s3cret")), clientCalls)
        assertEquals(0, sessionReads)
    }

    @Test
    fun withoutAServiceAccountTheSavedUserSessionIsUsed() = runTest {
        val selected = assertIs<CredentialResult.Selected>(resolve(emptyMap()))

        assertEquals(BackendCredential.Bearer("user-access"), selected.credential)
        assertEquals(BackendCredentialType.USER_SESSION, selected.type)
        assertTrue(clientCalls.isEmpty())
    }

    @Test
    fun halfOfTheServiceAccountIsAnErrorNotASilentFallbackToTheSession() = runTest {
        listOf(
            mapOf("DSBUILDER_CLIENT_ID" to "id"),
            mapOf("DSBUILDER_CLIENT_SECRET" to "secret"),
        ).forEach { env ->
            val failed = assertIs<CredentialResult.Failed>(resolve(env))

            assertEquals(AuthErrorCode.AUTH_REQUIRED, failed.code)
            assertTrue(failed.message.contains("DSBUILDER_CLIENT_ID"))
            assertTrue(failed.message.contains("DSBUILDER_CLIENT_SECRET"))
        }
        assertTrue(clientCalls.isEmpty())
        assertEquals(0, sessionReads)
    }

    @Test
    fun aRefusedServiceLoginFailsWithoutLeakingTheSecret() = runTest {
        clientResult = AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: credentials are invalid or expired.")

        val failed = assertIs<CredentialResult.Failed>(
            resolve(mapOf("DSBUILDER_CLIENT_ID" to "id", "DSBUILDER_CLIENT_SECRET" to "top-secret")),
        )

        assertEquals(AuthErrorCode.AUTH_REQUIRED, failed.code)
        assertTrue(!failed.message.contains("top-secret"))
        assertEquals(0, sessionReads)
    }
}
