package com.dsbuilder.app

import java.net.URI

/**
 * Настройки публичного входа, не зависящие от Docker Compose.
 * @property pluginTimeoutSeconds Ожидание ответа публикации после приёма архива.
 * @property port Проверенное значение настройки публичного входа.
 * @property keycloakUrl Проверенное значение настройки публичного входа.
 * @property realm Проверенное значение настройки публичного входа.
 * @property webOrigin Проверенное значение настройки публичного входа.
 * @property shutdownTimeoutMs Проверенное значение настройки публичного входа.
 * @property timeoutSeconds Проверенное значение настройки публичного входа.
 * @property documentationMaxBytes Проверенное значение настройки публичного входа.
 * @property documentationRateLimited Включает прежнее production-ограничение документации.
 * @property publicUrl Проверенное значение настройки публичного входа.
 * @property trustedProxyCidrs Проверенное значение настройки публичного входа.
 */
data class GatewayConfiguration(
    val port: Int,
    val keycloakUrl: String,
    val realm: String,
    val webOrigin: String?,
    val shutdownTimeoutMs: Long,
    val timeoutSeconds: Long,
    val documentationMaxBytes: Long,
    val publicUrl: String,
    val documentationRateLimited: Boolean = false,
    val trustedProxyCidrs: List<String>,
    val pluginTimeoutSeconds: Long = 120,
) {
    companion object {
        /** Читает env и отклоняет ошибочные значения до создания ресурсов. */
        fun fromEnvironment(env: Map<String, String> = System.getenv()): GatewayConfiguration {
            fun positive(name: String, default: Long): Long =
                (
                    env[name]?.let {
                        requireNotNull(it.toLongOrNull()) {
                            "$name must be a positive integer"
                        }
                    } ?: default
                    ).also { require(it > 0) { "$name must be positive" } }
            val keycloak = keycloakOrigin(env)
            val uri = URI(keycloak)
            require(uri.scheme in setOf("http", "https") && uri.host != null && uri.userInfo == null) {
                "KEYCLOAK_INTERNAL_URL must be an HTTP(S) origin"
            }
            val publicUrl = env["BACKEND_PUBLIC_URL"]
                ?: env["KEYCLOAK_ISSUER"]?.substringBefore("/realms/")
                ?: "http://localhost:8080"
            val publicUri = URI(publicUrl)
            require(
                publicUri.scheme in setOf("http", "https") && publicUri.host != null && publicUri.userInfo == null,
            ) {
                "BACKEND_PUBLIC_URL must be an HTTP(S) origin"
            }
            val proxies = env["BACKEND_TRUSTED_PROXIES"]?.split(',')
                ?.map(String::trim)?.filter(String::isNotBlank).orEmpty()
            com.dsbuilder.app.presentation.ProxyTrust(proxies)
            val realm = env["KEYCLOAK_REALM"] ?: "dsbuilder"
            require(realm.matches(Regex("[A-Za-z0-9_.-]+"))) { "Invalid KEYCLOAK_REALM" }
            val port = positive("BACKEND_PORT", 8080).also { require(it <= 65535) { "Invalid BACKEND_PORT" } }
            return GatewayConfiguration(
                port.toInt(), keycloak.trimEnd('/'), realm,
                env["OIDC_WEB_ORIGIN"]?.takeIf(String::isNotBlank),
                positive("BACKEND_SHUTDOWN_TIMEOUT_MS", 30_000),
                positive("GATEWAY_PROXY_TIMEOUT_SECONDS", 300),
                parseSize(env["DOCUMENTATION_MAX_REQUEST_SIZE"] ?: "101m"),
                publicUrl = publicUrl.trimEnd('/'),
                trustedProxyCidrs = proxies,
                pluginTimeoutSeconds = positive("COMPOSE_PLUGIN_TIMEOUT_SECONDS", 120),
                documentationRateLimited = documentationLimit(env),
            )
        }

        private fun documentationLimit(env: Map<String, String>): Boolean =
            env["DOCUMENTATION_RATE_LIMIT_ENABLED"]?.toBooleanStrict() ?: false

        private fun keycloakOrigin(env: Map<String, String>): String =
            env["KEYCLOAK_INTERNAL_URL"] ?: env["PROJECTS_IDENTITY_KEYCLOAK_BASE_URL"] ?: "http://localhost:8090"

        /** Разбирает размер в синтаксисе конфигурации прежнего nginx. */
        fun parseSize(raw: String): Long {
            val match = Regex("([0-9]+)([kKmM]?)").matchEntire(raw)
                ?: error("Invalid DOCUMENTATION_MAX_REQUEST_SIZE")
            val multiplier = when (match.groupValues[2].lowercase()) {
                "k" -> 1024L
                "m" -> 1024L * 1024
                else -> 1L
            }
            return Math.multiplyExact(match.groupValues[1].toLong(), multiplier).also {
                require(it > 0) { "DOCUMENTATION_MAX_REQUEST_SIZE must be positive" }
            }
        }
    }
}
