package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.EnvironmentReader

/**
 * Имя env-переменной с backend API URL.
 */
public const val API_URL_ENV: String = "DSBUILDER_API_URL"

/**
 * Default backend API URL для CLI, если runtime override не задан.
 */
public const val DEFAULT_API_URL: String = "https://gateway.design-system-builder.ru"

/**
 * Runtime-источник, из которого получен backend API URL.
 */
public enum class ApiUrlSource {
    /**
     * Значение передано аргументом `--api-url`.
     */
    ARGUMENT,

    /**
     * Значение прочитано из env-переменной `DSBUILDER_API_URL`.
     */
    ENVIRONMENT,

    /**
     * Значение взято из умолчания в коде, указывающего на общую установку backend.
     */
    CODE_DEFAULT,
}

/**
 * Результат resolution backend API URL.
 *
 * @property value base URL backend API.
 * @property source runtime-источник URL.
 */
public data class ResolvedApiUrl(
    public val value: String,
    public val source: ApiUrlSource,
) {
    /**
     * Человекочитаемое имя источника для вывода CLI.
     */
    public val sourceName: String
        get() = when (source) {
            ApiUrlSource.ARGUMENT -> "--api-url"
            ApiUrlSource.ENVIRONMENT -> API_URL_ENV
            ApiUrlSource.CODE_DEFAULT -> "default"
        }

    /**
     * Признак того, что значение получено из умолчания в коде.
     */
    public val isCodeDefault: Boolean
        get() = source == ApiUrlSource.CODE_DEFAULT
}

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
            return ResolvedApiUrl(value = override, source = ApiUrlSource.ARGUMENT)
        }

        environmentReader.get(API_URL_ENV)?.takeIf { it.isNotBlank() }?.let {
            return ResolvedApiUrl(value = it, source = ApiUrlSource.ENVIRONMENT)
        }

        return ResolvedApiUrl(value = DEFAULT_API_URL, source = ApiUrlSource.CODE_DEFAULT)
    }

    /**
     * Возвращает API URL для пишущей операции, отклоняя умолчание в коде.
     *
     * Умолчание указывает на общую установку backend, поэтому запись по нему запрещена.
     */
    public fun resolveForWrite(override: String?): WriteApiUrlResult {
        val resolved = resolve(override)
        return if (resolved.isCodeDefault) {
            WriteApiUrlResult.Rejected(
                "Error: writing commands require an explicit backend API URL. " +
                    "Pass --api-url or set $API_URL_ENV.",
            )
        } else {
            WriteApiUrlResult.Resolved(resolved)
        }
    }
}

/**
 * Результат resolution API URL для пишущей операции.
 */
public sealed interface WriteApiUrlResult {
    /**
     * URL получен явно.
     *
     * @property url разрешённый URL вместе с источником.
     */
    public data class Resolved(
        public val url: ResolvedApiUrl,
    ) : WriteApiUrlResult

    /**
     * URL получен из умолчания в коде и потому отклонён.
     *
     * @property message deterministic сообщение для CLI output.
     */
    public data class Rejected(
        public val message: String,
    ) : WriteApiUrlResult
}
