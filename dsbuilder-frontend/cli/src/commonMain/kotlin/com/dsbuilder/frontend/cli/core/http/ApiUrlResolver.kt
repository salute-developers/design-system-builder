package com.dsbuilder.frontend.cli.core.http

import com.dsbuilder.frontend.cli.core.credentials.EnvironmentReader

internal const val API_URL_ENV = "DSBUILDER_API_URL"

/**
 * Default backend API URL для CLI, если runtime override не задан.
 */
public const val DEFAULT_API_URL: String = "https://gateway.design-system-builder.ru"

/**
 * Результат resolution backend API URL.
 *
 * @property value base URL backend API.
 * @property source runtime-источник URL.
 */
public data class ResolvedApiUrl(
    public val value: String,
    public val source: String,
)

/**
 * Определяет backend API URL без чтения `.sdds/config.json`.
 */
public class ApiUrlResolver(
    private val environmentReader: EnvironmentReader,
) {
    /**
     * Возвращает API URL в порядке `--api-url`, `DSBUILDER_API_URL`, code default.
     */
    public fun resolve(override: String?): ResolvedApiUrl {
        if (!override.isNullOrBlank()) {
            return ResolvedApiUrl(value = override, source = "--api-url")
        }

        environmentReader.get(API_URL_ENV)?.takeIf { it.isNotBlank() }?.let {
            return ResolvedApiUrl(value = it, source = API_URL_ENV)
        }

        return ResolvedApiUrl(value = DEFAULT_API_URL, source = "default")
    }
}
