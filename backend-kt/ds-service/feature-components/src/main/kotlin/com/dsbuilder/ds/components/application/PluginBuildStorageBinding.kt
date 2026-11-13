package com.dsbuilder.ds.components.application

/** Хранилище файлов билдов платформы и настройки её публикации. */
data class PluginBuildStorageBinding(
    /** Хранилище файлов билдов платформы. */
    val storage: PluginBuildStorage,
    /** Настройки публикации платформы. */
    val settings: PluginBuildSettings,
)
