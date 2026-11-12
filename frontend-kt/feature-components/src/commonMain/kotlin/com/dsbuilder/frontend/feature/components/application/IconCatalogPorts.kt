package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifest

/** Результат чтения источника иконок. */
internal sealed interface IconManifestReadResult {
    /**
     * Манифест собран или прочитан.
     *
     * @property manifest манифест.
     * @property warnings предупреждения (неполные размеры, метаданные), не мешающие отправке.
     */
    data class Read(val manifest: IconManifest, val warnings: List<String>) : IconManifestReadResult

    /** Источник прочитать не удалось; [message] детерминированно для вывода CLI. */
    data class Failed(val message: String) : IconManifestReadResult
}

/** Port источников и хранения манифеста иконок на локальном диске. */
internal interface IconManifestStore {
    /**
     * Собирает манифест из каталога пакета `@salutejs/sdds-icons` (`svg/16`, `svg/24`, `svg/36`).
     * Версия берётся из [packageVersion], иначе из `package.json` каталога.
     */
    fun fromDirectory(path: String, packageVersion: String?): IconManifestReadResult

    /** Читает готовый `icons-manifest.json`. */
    fun fromManifest(path: String): IconManifestReadResult

    /** Записывает манифест в [path]; возвращает сообщение об ошибке или `null`. */
    fun write(path: String, manifest: IconManifest): String?
}

/**
 * Запрос на отправку каталога иконок.
 *
 * @property apiUrl разрешённый backend API URL.
 * @property credential служебная учётка или сессия администратора.
 * @property manifest манифест каталога.
 * @property dryRun пробная отправка без записи.
 * @property allowRemovingUsed разрешить удаление иконок, на которые есть ссылки в конфигурациях.
 */
internal class PublishIconCatalogRemoteCommand(
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
    val manifest: IconManifest,
    val dryRun: Boolean,
    val allowRemovingUsed: Boolean,
)

/** Port отправки каталога иконок на backend. */
internal interface IconCatalogRemoteSource {
    /** Отправляет манифест одним запросом. */
    suspend fun publish(command: PublishIconCatalogRemoteCommand): PublishIconCatalogRemoteResult
}

/** Результат отправки каталога иконок. */
internal sealed interface PublishIconCatalogRemoteResult {
    /** Backend принял запрос. */
    data class Published(val report: IconCatalogReport) : PublishIconCatalogRemoteResult

    /** Загрузка удаляет используемые иконки (`409 icons_in_use`). */
    data class InUse(val items: List<IconInUse>, val message: String) : PublishIconCatalogRemoteResult

    /** Отправка не выполнена; [message] детерминированно для вывода CLI. */
    data class Failed(val message: String) : PublishIconCatalogRemoteResult
}
