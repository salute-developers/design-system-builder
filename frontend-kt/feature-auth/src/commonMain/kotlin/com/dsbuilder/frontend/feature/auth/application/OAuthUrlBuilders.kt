package com.dsbuilder.frontend.feature.auth.application

private val UNRESERVED_CHARS = ('A'..'Z') + ('a'..'z') + ('0'..'9') + listOf('-', '.', '_', '~')

/**
 * Percent-кодирование значения query-параметра по RFC 3986 (`application/x-www-form-urlencoded`
 * здесь не подходит — OAuth-параметры кодируются как обычные URI query-компоненты). `commonMain`,
 * так как `java.net.URLEncoder` недоступен вне JVM: используется и отсюда ([LogoutUrlBuilder]), и
 * из `jvmMain`'s `AuthorizeUrlBuilder` (там же живёт `PkcePair`, сам `jvmMain`-only в `core-auth`).
 */
internal fun String.percentEncodeQueryValue(): String {
    val builder = StringBuilder()
    for (byte in encodeToByteArray()) {
        val unsigned = byte.toInt() and 0xFF
        val char = unsigned.toChar()
        if (char in UNRESERVED_CHARS) {
            builder.append(char)
        } else {
            builder.append('%')
            val hex = unsigned.toString(16).uppercase()
            if (hex.length < 2) builder.append('0')
            builder.append(hex)
        }
    }
    return builder.toString()
}

internal fun buildOAuthQuery(params: Map<String, String>): String =
    params.entries.joinToString("&") { (key, value) -> "$key=${value.percentEncodeQueryValue()}" }

/**
 * Собирает end-session URL Keycloak для явного логаута — открывается в системном браузере, чтобы
 * завершить и SSO browser-сессию, а не только локальную сессию клиента.
 */
public class LogoutUrlBuilder(
    private val gatewayBaseUrl: String,
    private val clientId: String,
) {
    /** Строит полный end-session URL с `redirect_uri` после логаута. */
    public fun build(postLogoutRedirectUri: String): String {
        val query = buildOAuthQuery(
            linkedMapOf(
                "client_id" to clientId,
                "post_logout_redirect_uri" to postLogoutRedirectUri,
            ),
        )
        return "${gatewayBaseUrl.trimEnd('/')}/realms/dsbuilder/protocol/openid-connect/logout?$query"
    }
}
