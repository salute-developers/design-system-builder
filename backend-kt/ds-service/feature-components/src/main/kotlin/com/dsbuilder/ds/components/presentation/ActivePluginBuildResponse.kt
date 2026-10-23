package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.ActivePluginBuild
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable

/** Ответ выдачи адреса активного билда. */
@Serializable
data class ActivePluginBuildResponse(
    /** Идентификатор билда. */
    val buildId: String,
    /** Версия `uikit-compose`. */
    val uikitComposeVersion: String,
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
        fun from(value: ActivePluginBuild) = ActivePluginBuildResponse(
            buildId = value.build.buildId,
            uikitComposeVersion = value.build.uikitComposeVersion,
            metaSha256 = value.build.metaSha256,
            protocolVersion = value.build.protocolVersion,
            pluginUrl = value.pluginUrl,
            publishedAt = value.build.publishedAt.toString(),
        )
    }
}
