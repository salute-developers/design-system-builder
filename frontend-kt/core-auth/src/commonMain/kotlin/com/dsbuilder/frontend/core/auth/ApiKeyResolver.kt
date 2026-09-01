package com.dsbuilder.frontend.core.auth

/**
 * Имя env-переменной с project API key по умолчанию.
 */
public const val DEFAULT_API_KEY_ENV: String = "DSBUILDER_API_KEY"

/**
 * Результат resolution project API key.
 *
 * @property value raw API key, используемый только для runtime request.
 * @property source описание runtime-источника.
 */
public data class ResolvedApiKey(
    public val value: String,
    public val source: String,
)

/**
 * Определяет project API key из runtime sources без сохранения raw secret.
 */
public class ApiKeyResolver(
    private val environmentReader: EnvironmentReader,
) {
    /**
     * Возвращает API key в порядке `--api-key`, configured env, `DSBUILDER_API_KEY`.
     */
    public fun resolve(
        override: String?,
        configuredEnvName: String?,
    ): ResolvedApiKey {
        if (!override.isNullOrBlank()) {
            return ResolvedApiKey(value = override, source = "--api-key")
        }

        if (!configuredEnvName.isNullOrBlank()) {
            environmentReader.get(configuredEnvName)?.takeIf { it.isNotBlank() }?.let {
                return ResolvedApiKey(value = it, source = configuredEnvName)
            }
        }

        environmentReader.get(DEFAULT_API_KEY_ENV)?.takeIf { it.isNotBlank() }?.let {
            return ResolvedApiKey(value = it, source = DEFAULT_API_KEY_ENV)
        }

        val expected = listOfNotNull(configuredEnvName, DEFAULT_API_KEY_ENV)
            .distinct()
            .joinToString(", ")
        throw MissingApiKeyException("API key is not configured. Set one of: $expected, or pass --api-key.")
    }
}

/**
 * Ошибка отсутствующего project API key.
 */
public class MissingApiKeyException(
    message: String,
) : RuntimeException(message)
