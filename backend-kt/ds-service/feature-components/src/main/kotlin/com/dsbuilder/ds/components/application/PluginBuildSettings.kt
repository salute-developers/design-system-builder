package com.dsbuilder.ds.components.application

import java.time.Duration

/** Настройки публикации плагина, заданные окружением. */
data class PluginBuildSettings(
    /** Публичный адрес префикса плагина в хранилище, без завершающего `/`. */
    val publicBaseUrl: String,
    /** Сколько последних билдов хранить кроме активного. */
    val keepBuilds: Int = DEFAULT_KEEP_BUILDS,
    /** Через сколько файлы без строки в БД считаются осиротевшими. */
    val orphanGrace: Duration = DEFAULT_ORPHAN_GRACE,
    /** Лимиты архива. */
    val limits: PluginArchiveLimits = PluginArchiveLimits(),
) {
    /** Публичный адрес каталога билда с завершающим `/`. */
    fun pluginUrl(buildId: String): String = "${publicBaseUrl.trimEnd('/')}/builds/$buildId/"

    /** Значения по умолчанию. */
    companion object {
        /** Пять последних билдов. */
        const val DEFAULT_KEEP_BUILDS = 5

        /** 24 часа. */
        val DEFAULT_ORPHAN_GRACE: Duration = Duration.ofHours(24)
    }
}
