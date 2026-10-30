package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaManifest

/**
 * Архив плагина, прочитанный с диска.
 *
 * @property path абсолютный путь архива.
 * @property zipBytes байты архива как есть.
 * @property manifestText содержимое `preview-plugin.json`.
 * @property metaBytes байты `api-meta.json`; sha256 считается от них, а не от разобранного текста.
 */
internal class PreviewPluginArchive(
    val path: String,
    val zipBytes: ByteArray,
    val manifestText: String,
    val metaBytes: ByteArray,
)

/** Port чтения архива плагина, указанного пользователем. */
internal interface PreviewPluginArchiveSource {
    /** Читает архив [path]; относительный путь приводится к абсолютному. */
    fun read(path: String): PreviewPluginArchiveResult
}

/** Результат чтения архива плагина. */
internal sealed interface PreviewPluginArchiveResult {
    /** Архив прочитан. */
    data class Read(val archive: PreviewPluginArchive) : PreviewPluginArchiveResult

    /** Архив прочитать не удалось; [message] детерминированно для вывода CLI. */
    data class Failed(val message: String) : PreviewPluginArchiveResult
}

/**
 * Запрос на отправку билда плагина.
 *
 * @property platform платформа плагина: от неё зависят маршрут и `platform` меты.
 * @property apiUrl разрешённый backend API URL.
 * @property credential служебная учётка или сессия администратора.
 * @property archive архив плагина.
 * @property manifest нормализованная мета из `api-meta.json` архива.
 * @property source имя файла меты без директорий.
 * @property dryRun пробная отправка без записи.
 */
internal class PublishPreviewPluginRemoteCommand(
    val platform: TargetPlatform,
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
    val archive: PreviewPluginArchive,
    val manifest: ApiMetaManifest,
    val source: String,
    val dryRun: Boolean,
)

/** Port отправки билда плагина на backend. */
internal interface PreviewPluginRemoteSource {
    /** Отправляет архив и мету одним запросом. */
    suspend fun publish(command: PublishPreviewPluginRemoteCommand): PublishPreviewPluginRemoteResult
}

/** Результат отправки билда плагина. */
internal sealed interface PublishPreviewPluginRemoteResult {
    /**
     * Backend принял запрос.
     *
     * @property outcome `published`, `activated` или `unchanged`.
     * @property buildId идентификатор билда.
     * @property libraryVersion версия библиотеки компонентов билда.
     * @property pluginUrl публичный адрес каталога билда.
     * @property report отчёт импорта меты.
     */
    data class Published(
        val outcome: String,
        val buildId: String,
        val libraryVersion: String,
        val pluginUrl: String,
        val report: ApiMetaImportReport,
    ) : PublishPreviewPluginRemoteResult

    /** Билд с тем же идентификатором уже опубликован с другим содержимым. */
    data class Conflict(val message: String) : PublishPreviewPluginRemoteResult

    /** Отправка не выполнена; [message] детерминированно для вывода CLI. */
    data class Failed(val message: String) : PublishPreviewPluginRemoteResult
}
