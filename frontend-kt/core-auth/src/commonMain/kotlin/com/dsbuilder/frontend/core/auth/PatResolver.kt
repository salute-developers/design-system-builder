package com.dsbuilder.frontend.core.auth

/**
 * Имя env-переменной с PAT по умолчанию.
 */
public const val DEFAULT_API_KEY_ENV: String = "DSBUILDER_API_KEY"

/**
 * Результат resolution PAT.
 *
 * @property value raw API key, используемый только для runtime request.
 * @property source описание runtime-источника.
 */
public data class ResolvedPat(
    public val value: String,
    public val source: String,
)

/**
 * Определяет PAT из runtime sources без сохранения raw secret.
 */
public class PatResolver(
    private val environmentReader: EnvironmentReader,
) {
    /**
     * Возвращает API key в порядке `--api-key`, configured env, `DSBUILDER_API_KEY`.
     */
    public fun resolve(
        override: String?,
        configuredEnvName: String?,
        projectEnvironment: EnvironmentReader? = null,
    ): ResolvedPat {
        if (!override.isNullOrBlank()) {
            return ResolvedPat(value = override, source = "--api-key")
        }

        if (!configuredEnvName.isNullOrBlank()) {
            (
                environmentReader.get(configuredEnvName)?.takeIf { it.isNotBlank() }
                    ?: projectEnvironment?.get(configuredEnvName)?.takeIf { it.isNotBlank() }
                )?.let {
                return ResolvedPat(value = it, source = configuredEnvName)
            }
        }

        (
            environmentReader.get(DEFAULT_API_KEY_ENV)?.takeIf { it.isNotBlank() }
                ?: projectEnvironment?.get(DEFAULT_API_KEY_ENV)?.takeIf { it.isNotBlank() }
            )?.let {
            return ResolvedPat(value = it, source = DEFAULT_API_KEY_ENV)
        }

        val expected = listOfNotNull(configuredEnvName, DEFAULT_API_KEY_ENV)
            .distinct()
            .joinToString(", ")
        throw MissingPatException("API key is not configured. Set one of: $expected, or pass --api-key.")
    }
}

/**
 * Ошибка отсутствующего PAT.
 */
public class MissingPatException(
    message: String,
) : RuntimeException(message)
