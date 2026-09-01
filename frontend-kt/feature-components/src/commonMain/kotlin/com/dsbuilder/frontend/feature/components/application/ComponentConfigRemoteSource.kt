package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiKey
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.feature.components.domain.ComponentImportReport
import com.dsbuilder.frontend.feature.components.domain.ConvertedComponentConfig
import com.dsbuilder.frontend.feature.components.domain.ExportedComponentPackage

/**
 * Port загрузки конфигураций компонентов в backend.
 *
 * Адрес backend и credentials приходят командой, а не читаются реализацией: их разрешают барьеры
 * use case до отправки, и повторное чтение обошло бы отказ по умолчательному API URL.
 */
internal interface ComponentConfigRemoteSource {
    /**
     * Отправляет весь пакет одним запросом.
     */
    fun import(command: ImportComponentsCommand): ImportComponentsResult

    /**
     * Забирает весь пакет одним запросом.
     */
    fun export(command: ExportComponentsCommand): ExportComponentsResult
}

/**
 * Запрос на выгрузку пакета.
 *
 * Дизайн-система адресуется идентификатором, а не именем: именем её адресует только старая
 * читающая ручка, а весь остальной CLI знает `designSystemId` из project config.
 *
 * @property apiUrl разрешённый backend API URL.
 * @property apiKey API key, авторизующий чтение.
 * @property projectId идентификатор проекта.
 * @property designSystemId дизайн-система, конфигурации которой выгружаются.
 */
internal data class ExportComponentsCommand(
    val apiUrl: ProjectApiUrl,
    val apiKey: ProjectApiKey,
    val projectId: ProjectId,
    val designSystemId: DesignSystemId,
)

/**
 * Результат выгрузки пакета.
 */
internal sealed interface ExportComponentsResult {
    /**
     * Backend вернул пакет.
     *
     * @property value выгруженный пакет.
     */
    data class Exported(
        val value: ExportedComponentPackage,
    ) : ExportComponentsResult

    /**
     * Выгрузка не выполнена.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(
        val message: String,
    ) : ExportComponentsResult
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
