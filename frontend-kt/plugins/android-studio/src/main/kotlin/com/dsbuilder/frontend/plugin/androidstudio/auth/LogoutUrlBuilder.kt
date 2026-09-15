package com.dsbuilder.frontend.plugin.androidstudio.auth

import java.net.URLEncoder

/**
 * Собирает end-session URL Keycloak. Нужен для реального выхода: очистка локальной сессии сама
 * по себе не трогает SSO cookie в системном браузере, поэтому следующий вход через него молча
 * получает новый code без формы логина — пользователь выглядит "не разлогиненным".
 */
public class LogoutUrlBuilder(
    private val gatewayBaseUrl: String,
    private val clientId: String,
) {
    /** Строит end-session URL с redirect обратно на loopback после завершения SSO-сессии. */
    public fun build(redirectUri: String): String {
        val params = linkedMapOf(
            "client_id" to clientId,
            "post_logout_redirect_uri" to redirectUri,
        )
        val query = params.entries.joinToString("&") { (key, value) ->
            "$key=${URLEncoder.encode(value, "UTF-8")}"
        }
        return "${gatewayBaseUrl.trimEnd('/')}/realms/dsbuilder/protocol/openid-connect/logout?$query"
    }
}
