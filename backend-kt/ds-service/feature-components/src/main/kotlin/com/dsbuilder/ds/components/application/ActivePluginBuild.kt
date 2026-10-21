package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PluginBuild

/** Активный билд плагина и его публичный адрес. */
data class ActivePluginBuild(
    /** Билд. */
    val build: PluginBuild,
    /** Публичный адрес каталога билда с завершающим `/`. */
    val pluginUrl: String,
)
