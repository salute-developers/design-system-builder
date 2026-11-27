package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.PatResolver
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

class OptionalReadCredentialTest {
    private var saved: UserSession? = null
    private var refreshes = 0
    private val store = object : CredentialStore {
        override suspend fun read(apiUrl: String): UserSession? = saved
        override suspend fun save(session: UserSession) { saved = session }
        override suspend fun delete(apiUrl: String) { saved = null }
    }
    private val tokens = object : TokenClient {
        override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> {
            refreshes++
            return AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "expired")
        }
        override suspend fun logout(apiUrl: String, refreshToken: String): AuthResult<Unit> = error("unused")
    }
    private fun provider(pat: String? = null) = RuntimeCredentialProvider(
        PatResolver(EnvironmentReader { pat }),
        store,
        tokens,
        nowMillis = { 0 },
    )
    private fun request(policy: CredentialPolicy = CredentialPolicy.AUTO) = CredentialRequest(
        ProjectApiUrl("https://api.test"),
        credentialEnvName = CredentialEnvName("KEY"),
        policy = policy,
        requirement = CredentialRequirement.READ_OPTIONAL,
    )

    @Test
    fun `missing credentials permit only optional auto reads`() = runTest {
        assertEquals(
            BackendCredential.Anonymous,
            assertIs<CredentialResult.Selected>(provider().resolve(request())).credential,
        )
        assertIs<CredentialResult.Failed>(
            provider().resolve(request().copy(requirement = CredentialRequirement.AUTHENTICATED)),
        )
        assertIs<CredentialResult.Failed>(provider().resolve(request(CredentialPolicy.PAT_ENV)))
        assertIs<CredentialResult.Failed>(provider().resolve(request(CredentialPolicy.USER_SESSION)))
        assertEquals(0, refreshes)
    }

    @Test
    fun `PAT remains selected before a session or anonymous access`() = runTest {
        val result = assertIs<CredentialResult.Selected>(provider("dsb_pat_test").resolve(request()))
        assertEquals(BackendCredential.PersonalAccessToken("dsb_pat_test"), result.credential)
        assertEquals(0, refreshes)
    }

    @Test
    fun `failed saved session never becomes anonymous`() = runTest {
        saved = UserSession(2, "https://api.test", "user", "refresh", 999999, 1)
        assertIs<CredentialResult.Failed>(provider().resolve(request()))
        assertEquals(1, refreshes)
    }
}
