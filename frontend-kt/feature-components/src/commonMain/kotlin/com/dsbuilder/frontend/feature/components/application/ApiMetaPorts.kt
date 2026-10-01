package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.PlatformRunPlan
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaManifest

/**
 * Port получения API-меты платформы из проекта пользователя.
 *
 * Реализация просит платформенный инструмент достать файл из артефакта UI-кита и читает его;
 * разбирает содержимое не она, а нормализатор платформы.
 */
internal interface ApiMetaSource {
    /**
     * Достаёт мету платформы и возвращает её текст.
     *
     * @param platform платформа, чью мету нужно получить.
     * @param toolOverride путь инструмента из `--tool`.
     * @param onPlan вызывается до запуска инструмента, чтобы presentation напечатала, что и чем запускается.
     */
    fun read(
        platform: TargetPlatform,
        toolOverride: String?,
        onPlan: (PlatformRunPlan) -> Unit,
    ): ApiMetaSourceResult
}

/** Результат получения меты. */
internal sealed interface ApiMetaSourceResult {
    /**
     * Мета получена.
     *
     * @property path абсолютный путь прочитанного файла.
     * @property text содержимое файла.
     */
    data class Read(val path: String, val text: String) : ApiMetaSourceResult

    /**
     * Мету получить не удалось.
     *
     * @property message deterministic сообщение для CLI output.
     */
    data class Failed(val message: String) : ApiMetaSourceResult
}

/**
 * Port загрузки манифеста API-меты в backend.
 *
 * Адрес и credentials приходят командой, а не читаются реализацией: их разрешают барьеры use case
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
 * @property credential credential, авторизующий запись.
 * @property projectId идентификатор проекта.
 * @property designSystemId дизайн-система, к которой привязываются компоненты.
 * @property platform значение `platform` для backend (`compose`, `xml`, `ios`, `web`).
 * @property source разрешённый источник меты: путь прочитанного файла.
 * @property dryRun выполнять ли импорт без сохранения изменений.
 * @property manifest что загружать.
 */
internal data class ImportApiMetaRemoteCommand(
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
    val projectId: ProjectId,
    val designSystemId: DesignSystemId,
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
