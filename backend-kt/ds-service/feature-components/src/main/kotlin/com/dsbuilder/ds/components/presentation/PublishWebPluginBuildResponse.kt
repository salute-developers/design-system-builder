package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.PublishResult
import kotlinx.serialization.Serializable

/** Ответ публикации web-плагина: как у Compose, но версия библиотеки в `libraryVersion`. */
@Serializable
data class PublishWebPluginBuildResponse(
    /** `published`, `activated` или `unchanged`. */
    val outcome: String,
    /** Была ли это пробная отправка. */
    val dryRun: Boolean,
    /** Идентификатор билда. */
    val buildId: String,
    /** Платформа билда (`web`). */
    val platform: String,
    /** Версия `plasma-new-hope`. */
    val libraryVersion: String,
    /** sha256 меты. */
    val metaSha256: String,
    /** Публичный адрес каталога билда. */
    val pluginUrl: String,
    /** Отчёт импорта меты. */
    val report: ImportApiMetaResponse,
) {
    /** Сборка ответа. */
    companion object {
        /** Преобразует результат use case в ответ. */
        fun from(value: PublishResult, dryRun: Boolean): PublishWebPluginBuildResponse {
            val compose = PublishPluginBuildResponse.from(value, dryRun)
            return PublishWebPluginBuildResponse(
                outcome = compose.outcome,
                dryRun = dryRun,
                buildId = value.build.buildId,
                platform = value.build.platform,
                libraryVersion = value.build.libraryVersion,
                metaSha256 = value.build.metaSha256,
                pluginUrl = value.pluginUrl,
                report = compose.report,
            )
        }
    }
}
