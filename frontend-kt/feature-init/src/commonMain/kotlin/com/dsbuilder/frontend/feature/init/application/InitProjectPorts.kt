package com.dsbuilder.frontend.feature.init.application

import com.dsbuilder.frontend.core.domain.ProjectConfigDraft

/**
 * Port записи локального project config.
 */
internal fun interface ProjectConfigWriter {
    /**
     * Сохраняет project config без raw secrets.
     */
    fun create(command: CreateProjectConfigCommand): ProjectConfigWriteResult
}

/**
 * Command model для записи локального project config.
 *
 * @property config данные project config без raw secrets.
 * @property targetDirectory директория, где создается project config.
 */
internal data class CreateProjectConfigCommand(
    val config: ProjectConfigDraft,
    val targetDirectory: String,
)

/**
 * Результат записи локального project config.
 */
internal sealed interface ProjectConfigWriteResult {
    /**
     * Config был создан.
     *
     * @property configPath путь созданного config.
     */
    data class Created(
        val configPath: String,
    ) : ProjectConfigWriteResult

    /**
     * Config не был создан.
     *
     * @property message user-facing ошибка.
     */
    data class Failed(
        val message: String,
    ) : ProjectConfigWriteResult
}
