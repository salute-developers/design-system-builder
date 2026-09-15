package com.dsbuilder.frontend.plugin.androidstudio.auth

import com.dsbuilder.frontend.core.auth.PkcePair
import java.net.URLEncoder

/**
 * Собирает authorize URL для Authorization Code + PKCE flow плагина. Не `/auth/login` — этот
 * путь на gateway жёстко возвращает `404` — а прямой Keycloak authorization endpoint.
 */
public class AuthorizeUrlBuilder(
    private val gatewayBaseUrl: String,
    private val clientId: String,
) {
    /** Строит полный authorize URL с заданными PKCE-параметрами, `state` и `redirect_uri`. */
    public fun build(pkce: PkcePair, state: String, redirectUri: String): String {
        val params = linkedMapOf(
            "client_id" to clientId,
            "response_type" to "code",
            "redirect_uri" to redirectUri,
            "scope" to "openid",
            "code_challenge" to pkce.codeChallenge,
            "code_challenge_method" to pkce.codeChallengeMethod,
            "state" to state,
        )
        val query = params.entries.joinToString("&") { (key, value) ->
            "$key=${URLEncoder.encode(value, "UTF-8")}"
        }
        return "${gatewayBaseUrl.trimEnd('/')}/realms/dsbuilder/protocol/openid-connect/auth?$query"
    }
}
