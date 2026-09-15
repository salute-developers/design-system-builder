package com.dsbuilder.frontend.plugin.androidstudio.auth

import com.dsbuilder.frontend.core.auth.PkcePair
import kotlin.test.Test
import kotlin.test.assertTrue

class AuthorizeUrlBuilderTest {
    @Test
    fun buildProducesKeycloakAuthorizationEndpointWithPkceAndState() {
        val builder =
            AuthorizeUrlBuilder(gatewayBaseUrl = "https://gateway.example.com/", clientId = "dsbuilder-studio-plugin")
        val pkce = PkcePair(codeVerifier = "verifier-a", codeChallenge = "challenge-a")

        val url = builder.build(pkce, state = "state-a", redirectUri = "http://127.0.0.1:12345/callback")

        assertTrue(url.startsWith("https://gateway.example.com/realms/dsbuilder/protocol/openid-connect/auth?"))
        assertTrue(url.contains("client_id=dsbuilder-studio-plugin"))
        assertTrue(url.contains("response_type=code"))
        assertTrue(url.contains("code_challenge=challenge-a"))
        assertTrue(url.contains("code_challenge_method=S256"))
        assertTrue(url.contains("state=state-a"))
        assertTrue(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A12345%2Fcallback"))
    }

    @Test
    fun doesNotUseAuthLoginPath() {
        val builder =
            AuthorizeUrlBuilder(gatewayBaseUrl = "https://gateway.example.com", clientId = "dsbuilder-studio-plugin")
        val pkce = PkcePair(codeVerifier = "verifier-a", codeChallenge = "challenge-a")

        val url = builder.build(pkce, state = "state-a", redirectUri = "http://127.0.0.1:12345/callback")

        // /auth/login на gateway жёстко возвращает 404 — рабочий endpoint только /realms/....
        assertTrue(!url.contains("/auth/login"))
    }
}
