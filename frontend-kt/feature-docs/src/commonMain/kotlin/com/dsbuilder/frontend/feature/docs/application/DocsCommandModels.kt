package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.feature.docs.domain.ValidationError

/**
 * Command для команды `docs init`.
 *
 * @property targetDirectory директория, где создаётся структура docs/.
 */
public data class DocsInitCommand(
    public val targetDirectory: String,
)

/**
 * Результат команды `docs init`.
 */
public sealed interface DocsInitResult {
    /**
     * Структура создана.
     *
     * @property configPath путь созданного `structure.json`.
     */
    public data class Created(
        public val configPath: String,
    ) : DocsInitResult

    /**
     * Ошибка создания структуры.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val message: String,
    ) : DocsInitResult
}

/**
 * Command для команды `docs generate`.
 *
 * @property docsDir директория с результатом агрегатора; `null` — платформенный шаг и умолчание.
 * @property outputGzipPath путь к выходному gzip-архиву.
 * @property platform платформа документации; `null` — взять из project config.
 * @property aggregate запускать ли платформенную агрегацию перед сборкой пакета.
 * @property toolOverride путь платформенного инструмента из `--tool`.
 */
public data class DocsGenerateCommand(
    public val docsDir: String? = null,
    public val outputGzipPath: String,
    public val platform: String? = null,
    public val aggregate: Boolean = true,
    public val toolOverride: String? = null,
)

/**
 * Результат команды `docs generate`.
 */
public sealed interface DocsGenerateResult {
    /**
     * Пакет собран.
     *
     * @property bundlePath путь к собранному tar.gz-архиву.
     * @property docsDir дерево документации, из которого собран пакет.
     * @property aggregatedBy toolchain, собравший дерево на этом запуске; `null` — дерево было готово заранее.
     */
    public data class Success(
        public val bundlePath: String,
        public val docsDir: String,
        public val aggregatedBy: String? = null,
    ) : DocsGenerateResult

    /**
     * Пакет не собран из-за ошибок валидации.
     *
     * @property errors список ошибок валидации.
     */
    public data class ValidationFailed(
        public val errors: List<ValidationError>,
    ) : DocsGenerateResult

    /**
     * Ошибка сборки.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val message: String,
    ) : DocsGenerateResult
}

/**
 * Command для команды `docs publish`.
 *
 * @property bundlePath путь к tar.gz-архиву пакета.
 * @property apiKeyOverride runtime override из `--api-key`.
 * @property apiUrlOverride runtime override из `--api-url`.
 */
public data class DocsPublishCommand(
    public val bundlePath: String,
    public val apiKeyOverride: String?,
    public val apiUrlOverride: String?,
)

/**
 * Результат команды `docs publish`.
 */
public sealed interface DocsPublishResult {
    /**
     * Публикация принята.
     *
     * @property bundleId идентификатор принятого пакета.
     * @property jobId идентификатор задачи обработки.
     * @property status статус приёмки.
     */
    public data class Accepted(
        public val bundleId: String,
        public val jobId: String,
        public val status: String,
    ) : DocsPublishResult

    /**
     * Ошибка публикации.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val message: String,
    ) : DocsPublishResult
}
