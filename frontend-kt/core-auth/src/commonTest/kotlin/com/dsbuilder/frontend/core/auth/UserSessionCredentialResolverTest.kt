package com.dsbuilder.frontend.core.auth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private class FakeRefreshTokenStore : RefreshTokenStore {
    private var stored: String? = null

    override fun save(refreshToken: String) {
        stored = refreshToken
    }

    override fun load(): String? = stored

    override fun clear() {
        stored = null
    }
}

class UserSessionCredentialResolverTest {
    @Test
    fun noAccessTokenBeforeAnyTokensApplied() {
        val resolver = UserSessionCredentialResolver(FakeRefreshTokenStore())

        assertNull(resolver.currentAccessToken())
        assertNull(resolver.storedRefreshToken())
    }

    @Test
    fun applyTokensKeepsAccessTokenInMemoryAndPersistsRefreshToken() {
        val store = FakeRefreshTokenStore()
        val resolver = UserSessionCredentialResolver(store)

        resolver.applyTokens(
            UserOAuthTokens(accessToken = "access-a", refreshToken = "refresh-a", expiresInSeconds = 300),
        )

        assertEquals("access-a", resolver.currentAccessToken())
        assertEquals("refresh-a", resolver.storedRefreshToken())
        assertEquals("refresh-a", store.load())
    }

    @Test
    fun clearResetsAccessTokenAndRefreshTokenStore() {
        val store = FakeRefreshTokenStore()
        val resolver = UserSessionCredentialResolver(store)
        resolver.applyTokens(
            UserOAuthTokens(accessToken = "access-a", refreshToken = "refresh-a", expiresInSeconds = 300),
        )

        resolver.clear()

        assertNull(resolver.currentAccessToken())
        assertNull(resolver.storedRefreshToken())
        assertNull(store.load())
    }
}
