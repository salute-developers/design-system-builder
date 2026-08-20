package com.dsbuilder.frontend.cli.feature.docs.application

import com.dsbuilder.frontend.cli.feature.docs.domain.ValidationError

/**
 * Command для команды `docs init`.
 *
 * @property targetDirectory директория, где создаётся структура docs/.
 */
internal data class DocsInitCommand(
    val targetDirectory: String,
)

/**
 * Результат команды `docs init`.
 */
internal sealed interface DocsInitResult {
    /** Структура создана. */
    data class Created(
        val configPath: String,
    ) : DocsInitResult

    /** Ошибка создания структуры. */
    data class Failed(
        val message: String,
    ) : DocsInitResult
}

/**
 * Command для команды `docs generate`.
 *
 * @property docsDir директория с результатом агрегатора.
 * @property outputGzipPath путь к выходному gzip-архиву.
 * @property platform платформа документации.
 */
internal data class DocsGenerateCommand(
    val docsDir: String,
    val outputGzipPath: String,
    val platform: String,
)

/**
 * Результат команды `docs generate`.
 */
internal sealed interface DocsGenerateResult {
    /** Пакет собран. */
    data class Success(
        val bundlePath: String,
    ) : DocsGenerateResult

    /** Пакет не собран из-за ошибок валидации. */
    data class ValidationFailed(
        val errors: List<ValidationError>,
    ) : DocsGenerateResult

    /** Ошибка сборки. */
    data class Failed(
        val message: String,
    ) : DocsGenerateResult
}

/**
 * Command для команды `docs publish`.
 *
 * @property bundlePath путь к tar.gz-архиву пакета.
 * @property apiKeyOverride runtime override из `--api-key`.
 * @property apiUrlOverride runtime override из `--api-url`.
 */
internal data class DocsPublishCommand(
    val bundlePath: String,
    val apiKeyOverride: String?,
    val apiUrlOverride: String?,
)

/**
 * Результат команды `docs publish`.
 */
internal sealed interface DocsPublishResult {
    /** Публикация принята. */
    data class Accepted(
        val bundleId: String,
        val jobId: String,
        val status: String,
    ) : DocsPublishResult

    /** Ошибка публикации. */
    data class Failed(
        val message: String,
    ) : DocsPublishResult
}
