package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.PkcePair

/**
 * Собирает authorize URL для Authorization Code + PKCE flow. Не `/auth/login` — этот путь на
 * gateway жёстко возвращает `404` — а прямой Keycloak authorization endpoint.
 *
 * `jvmMain`, так как принимает [PkcePair] — тот сам `jvmMain`-only в `core-auth`.
 */
public class AuthorizeUrlBuilder(
    private val gatewayBaseUrl: String,
    private val clientId: String,
) {
    /** Строит полный authorize URL с заданными PKCE-параметрами, `state` и `redirect_uri`. */
    public fun build(pkce: PkcePair, state: String, redirectUri: String): String {
        val query = buildOAuthQuery(
            linkedMapOf(
                "client_id" to clientId,
                "response_type" to "code",
                "redirect_uri" to redirectUri,
                "scope" to "openid",
                "code_challenge" to pkce.codeChallenge,
                "code_challenge_method" to pkce.codeChallengeMethod,
                "state" to state,
            ),
        )
        return "${gatewayBaseUrl.trimEnd('/')}/realms/dsbuilder/protocol/openid-connect/auth?$query"
    }
}
