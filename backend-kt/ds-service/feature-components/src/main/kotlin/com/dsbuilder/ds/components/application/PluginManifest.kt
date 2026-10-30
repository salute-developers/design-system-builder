package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PreviewPluginPlatform

/** Проверенный manifest плагина. */
data class PluginManifest(
    /** Платформа плагина. */
    val platform: PreviewPluginPlatform,
    /** Идентификатор билда. */
    val version: String,
    /** Полный sha коммита. */
    val commit: String,
    /** Версия библиотеки платформы: `uikitComposeVersion` или `plasmaNewHopeVersion`. */
    val libraryVersion: String,
    /** sha256 файла меты из manifest. */
    val apiMetaSha256: String,
    /** Версия Preview Protocol. */
    val protocolVersion: Int,
    /** Точка входа плагина. */
    val entrypoint: String,
)
