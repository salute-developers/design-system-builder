package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaManifest

/**
 * Port чтения файла API-меты, указанного пользователем.
 *
 * Файл — вывод генератора меты или вывод плагина `dsBuilder`; разбирает его нормализатор платформы, а
 * реализация только находит и читает файл.
 */
internal interface ApiMetaSource {
    /**
     * Читает файл меты.
     *
     * @param path путь файла из `--from`; относительный путь приводится к абсолютному.
     */
    fun read(path: String): ApiMetaSourceResult
}

/** Результат чтения файла меты. */
internal sealed interface ApiMetaSourceResult {
    /**
     * Файл прочитан.
     *
     * @property path абсолютный путь прочитанного файла.
     * @property text содержимое файла.
     */
    data class Read(val path: String, val text: String) : ApiMetaSourceResult

    /**
     * Файл прочитать не удалось.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(val message: String) : ApiMetaSourceResult
}

/**
 * Port загрузки манифеста API-меты в backend.
 *
 * Адрес и credential приходят командой, а не читаются реализацией: их разрешают барьеры use case
 * до отправки, и повторное чтение обошло бы отказ по умолчательному API URL.
 */
internal interface ApiMetaRemoteSource {
    /** Отправляет весь манифест одним запросом. */
    suspend fun import(command: ImportApiMetaRemoteCommand): ImportApiMetaRemoteResult
}

/**
 * Запрос на загрузку манифеста.
 *
 * @property apiUrl разрешённый backend API URL.
 * @property credential user session администратора.
 * @property platform значение `platform` для backend (`compose`, `xml`, `ios`, `web`).
 * @property source имя файла меты без директорий: локальный путь администратора на сервер не уходит.
 * @property dryRun выполнять ли импорт без сохранения изменений.
 * @property manifest что загружать.
 */
internal data class ImportApiMetaRemoteCommand(
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
    val platform: String,
    val source: String,
    val dryRun: Boolean,
    val manifest: ApiMetaManifest,
)

/** Результат загрузки манифеста. */
internal sealed interface ImportApiMetaRemoteResult {
    /**
     * Backend принял запрос и вернул отчёт.
     *
     * @property report отчёт импорта.
     */
    data class Imported(val report: ApiMetaImportReport) : ImportApiMetaRemoteResult

    /**
     * Загрузка не выполнена.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(val message: String) : ImportApiMetaRemoteResult
}
