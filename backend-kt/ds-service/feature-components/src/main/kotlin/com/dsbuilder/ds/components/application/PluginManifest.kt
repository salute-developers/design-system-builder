package com.dsbuilder.ds.components.application

/** Проверенный manifest плагина. */
data class PluginManifest(
    /** Идентификатор билда. */
    val version: String,
    /** Полный sha коммита. */
    val commit: String,
    /** Версия `uikit-compose`. */
    val uikitComposeVersion: String,
    /** sha256 файла меты из manifest. */
    val apiMetaSha256: String,
    /** Версия Preview Protocol. */
    val protocolVersion: Int,
    /** Точка входа плагина. */
    val entrypoint: String,
)
