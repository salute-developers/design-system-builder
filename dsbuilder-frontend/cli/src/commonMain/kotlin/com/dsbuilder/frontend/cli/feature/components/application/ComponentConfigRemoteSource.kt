package com.dsbuilder.frontend.cli.feature.components.application

import com.dsbuilder.frontend.cli.core.domain.DesignSystemId
import com.dsbuilder.frontend.cli.core.domain.ProjectApiKey
import com.dsbuilder.frontend.cli.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.cli.core.domain.ProjectId
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentImportReport
import com.dsbuilder.frontend.cli.feature.components.domain.ConvertedComponentConfig

/**
 * Port загрузки конфигураций компонентов в backend.
 *
 * Адрес backend и credentials приходят командой, а не читаются реализацией: их разрешают барьеры
 * use case до отправки, и повторное чтение обошло бы отказ по умолчательному API URL.
 */
internal fun interface ComponentConfigRemoteSource {
    /**
     * Отправляет весь пакет одним запросом.
     */
    fun import(command: ImportComponentsCommand): ImportComponentsResult
}

/**
 * Запрос на импорт пакета.
 *
 * @property apiUrl разрешённый backend API URL.
 * @property apiKey API key, авторизующий запись.
 * @property projectId идентификатор проекта.
 * @property designSystemId дизайн-система, в которую грузится пакет.
 * @property packageName имя из `meta.json`.
 * @property packageOrigin разрешённый источник пакета.
 * @property dryRun выполнять ли импорт без сохранения изменений.
 * @property components конфигурации, преобразованные в common-формат.
 */
internal data class ImportComponentsCommand(
    val apiUrl: ProjectApiUrl,
    val apiKey: ProjectApiKey,
    val projectId: ProjectId,
    val designSystemId: DesignSystemId,
    val packageName: String,
    val packageOrigin: String,
    val dryRun: Boolean,
    val components: List<ConvertedComponentConfig>,
)

/**
 * Результат импорта пакета.
 */
internal sealed interface ImportComponentsResult {
    /**
     * Backend принял запрос и вернул отчёт.
     *
     * @property report отчёт импорта.
     */
    data class Imported(
        val report: ComponentImportReport,
    ) : ImportComponentsResult

    /**
     * Импорт не выполнен.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(
        val message: String,
    ) : ImportComponentsResult
}
