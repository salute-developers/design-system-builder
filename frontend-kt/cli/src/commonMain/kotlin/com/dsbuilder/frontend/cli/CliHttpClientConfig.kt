package com.dsbuilder.frontend.cli

import io.ktor.client.HttpClientConfig
import io.ktor.client.plugins.HttpTimeout

private const val BACKEND_CONNECT_TIMEOUT_MILLIS = 10_000L
private const val BACKEND_REQUEST_TIMEOUT_MILLIS = 300_000L

/**
 * Настраивает сетевые пределы CLI для долгих backend-операций.
 *
 * `components push` пока выполняет полный импорт последовательно даже в dry-run, поэтому
 * стандартного socket timeout платформенного движка недостаточно. Пятиминутный предел
 * согласован с proxy timeout gateway; после оптимизации импорта его можно уменьшить.
 */
internal fun HttpClientConfig<*>.configureCliTimeouts() {
    install(HttpTimeout) {
        connectTimeoutMillis = BACKEND_CONNECT_TIMEOUT_MILLIS
        requestTimeoutMillis = BACKEND_REQUEST_TIMEOUT_MILLIS
        socketTimeoutMillis = BACKEND_REQUEST_TIMEOUT_MILLIS
    }
}
