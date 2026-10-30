package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.ActivePluginBuild
import kotlinx.serialization.Serializable

/** Ответ выдачи адреса активного web-билда. */
@Serializable
data class ActiveWebPluginBuildResponse(
    /** Идентификатор билда. */
    val buildId: String,
    /** Платформа билда (`web`). */
    val platform: String,
    /** Версия `plasma-new-hope`. */
    val libraryVersion: String,
    /** sha256 меты. */
    val metaSha256: String,
    /** Версия Preview Protocol. */
    val protocolVersion: Int,
    /** Публичный адрес каталога билда с завершающим `/`. */
    val pluginUrl: String,
    /** Время публикации (ISO-8601). */
    val publishedAt: String,
) {
    /** Сборка ответа. */
    companion object {
        /** Преобразует активный билд в ответ. */
        fun from(value: ActivePluginBuild) = ActiveWebPluginBuildResponse(
            buildId = value.build.buildId,
            platform = value.build.platform,
            libraryVersion = value.build.libraryVersion,
            metaSha256 = value.build.metaSha256,
            protocolVersion = value.build.protocolVersion,
            pluginUrl = value.pluginUrl,
            publishedAt = value.build.publishedAt.toString(),
        )
    }
}
