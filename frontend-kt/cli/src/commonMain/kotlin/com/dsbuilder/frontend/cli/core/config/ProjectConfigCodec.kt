package com.dsbuilder.frontend.cli.core.config

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * Кодирует и декодирует `.sdds/config.json`.
 */
public class ProjectConfigCodec {
    private val json = Json {
        prettyPrint = true
        encodeDefaults = true
        ignoreUnknownKeys = false
    }

    /**
     * Декодирует JSON config в project model.
     *
     * @param text содержимое `.sdds/config.json`.
     * @return project config.
     */
    public fun decode(text: String): ProjectConfig =
        try {
            json.decodeFromString(ProjectConfig.serializer(), text)
        } catch (exception: SerializationException) {
            throw ProjectConfigException("Cannot parse .sdds/config.json: ${exception.message}", exception)
        } catch (exception: IllegalArgumentException) {
            throw ProjectConfigException("Cannot parse .sdds/config.json: ${exception.message}", exception)
        }

    /**
     * Кодирует project model в JSON config без raw API key и API URL полей.
     *
     * @param config project config.
     * @return JSON для `.sdds/config.json`.
     */
    public fun encode(config: ProjectConfig): String = json.encodeToString(ProjectConfig.serializer(), config)
}

/**
 * Ошибка чтения или декодирования project config.
 */
public class ProjectConfigException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)
