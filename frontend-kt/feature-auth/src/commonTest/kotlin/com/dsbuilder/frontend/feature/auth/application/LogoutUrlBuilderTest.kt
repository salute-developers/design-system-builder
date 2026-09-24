package com.dsbuilder.frontend.feature.auth.application

import kotlin.test.Test
import kotlin.test.assertTrue

class LogoutUrlBuilderTest {
    @Test
    fun buildProducesKeycloakEndSessionEndpoint() {
        val builder =
            LogoutUrlBuilder(gatewayBaseUrl = "https://gateway.example.com/", clientId = "dsbuilder-studio-plugin")

        val url = builder.build(postLogoutRedirectUri = "http://127.0.0.1:12345/callback")

        assertTrue(url.startsWith("https://gateway.example.com/realms/dsbuilder/protocol/openid-connect/logout?"))
        assertTrue(url.contains("client_id=dsbuilder-studio-plugin"))
        assertTrue(url.contains("post_logout_redirect_uri=http%3A%2F%2F127.0.0.1%3A12345%2Fcallback"))
    }
}
