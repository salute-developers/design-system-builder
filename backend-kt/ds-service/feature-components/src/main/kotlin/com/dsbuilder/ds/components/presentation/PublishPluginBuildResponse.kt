package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.PublishResult
import kotlinx.serialization.Serializable

/** Ответ публикации. */
@Serializable
data class PublishPluginBuildResponse(
    /** `published`, `activated`, `replaced` или `unchanged`. */
    val outcome: String,
    /** Была ли это пробная отправка. */
    val dryRun: Boolean,
    /** Идентификатор билда. */
    val buildId: String,
    /** Версия `uikit-compose`. */
    val uikitComposeVersion: String,
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
        fun from(value: PublishResult, dryRun: Boolean) = PublishPluginBuildResponse(
            outcome = value.kind.name.lowercase(),
            dryRun = dryRun,
            buildId = value.build.buildId,
            uikitComposeVersion = value.build.libraryVersion,
            metaSha256 = value.build.metaSha256,
            pluginUrl = value.pluginUrl,
            report = ImportApiMetaResponse.from(value.report),
        )
    }
}
