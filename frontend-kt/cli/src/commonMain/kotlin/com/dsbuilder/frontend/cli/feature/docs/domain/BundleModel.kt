package com.dsbuilder.frontend.cli.feature.docs.domain

import kotlinx.serialization.Serializable

/**
 * Результат сборки пакета документации.
 *
 * @property outputZipPath путь к созданному zip-архиву.
 * @property validationErrors список ошибок валидации (пусто при успехе).
 */
@Serializable
public data class DocumentationBundle(
    val outputZipPath: String,
    val validationErrors: List<ValidationError> = emptyList(),
)

/**
 * Ошибка валидации пакета документации.
 */
public sealed interface ValidationError {
    /** Content-файл не найден. */
    public data class MissingContent(
        /** Относительный путь к отсутствующему контенту. */
        val path: String,
    ) : ValidationError

    /** Дубликат относительного пути страницы. */
    public data class DuplicatePath(
        /** Относительный путь, который встречается дважды. */
        val path: String,
    ) : ValidationError

    /** Недопустимый путь (path traversal, абсолютный путь). */
    public data class InvalidPathTraversal(
        /** Относительный путь, вызвавший ошибку. */
        val path: String,
    ) : ValidationError

    /** Артефакт из manifest.json не найден. */
    public data class MissingArtifact(
        /** Относительный путь артефакта. */
        val path: String,
        /** Ожидаемый тип артефакта. */
        val expected: String,
    ) : ValidationError

    /** Ошибка парсинга structure.json. */
    public data class StructureParseError(
        /** Описание ошибки. */
        val message: String,
    ) : ValidationError
}
