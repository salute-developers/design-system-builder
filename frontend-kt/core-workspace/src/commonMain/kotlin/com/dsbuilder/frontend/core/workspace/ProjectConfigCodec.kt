package com.dsbuilder.frontend.core.workspace

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

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
            val credentialType = json.parseToJsonElement(text).jsonObject["credential"]
                ?.jsonObject?.get("type")?.jsonPrimitive?.content
            if (credentialType == "project-key-env") {
                throw ProjectConfigException("Replace credential.type project-key-env with pat-env for PAT.")
            }
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
public open class ProjectConfigException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

/**
 * Project config не найден: проект не инициализирован.
 *
 * Отличается от [ProjectConfigException] намеренно: отсутствие проекта — рабочая ситуация для
 * команд с историческим умолчанием, а нечитаемый или неверный config — ошибка, которую нельзя
 * молча превращать в это умолчание.
 */
public class ProjectNotInitializedException(
    message: String,
) : ProjectConfigException(message)
