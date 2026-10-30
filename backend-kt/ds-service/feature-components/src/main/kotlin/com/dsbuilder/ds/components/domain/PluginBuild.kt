package com.dsbuilder.ds.components.domain

import java.time.Instant

/** Опубликованный билд preview plugin. */
data class PluginBuild(
    /** Идентификатор билда: первые 12 символов `commit`. */
    val buildId: String,
    /** Платформа билда (`compose` или `web`). */
    val platform: String,
    /** Версия библиотеки, из которой собраны плагин и его мета: `uikit-compose` или `plasma-new-hope`. */
    val libraryVersion: String,
    /** sha256 файла `api-meta.json` билда. */
    val metaSha256: String,
    /** Полный sha коммита сборки. */
    val commit: String,
    /** Версия Preview Protocol из manifest. */
    val protocolVersion: Int,
    /** sha256 принятого архива. */
    val zipSha256: String,
    /** Размер распакованного содержимого в байтах. */
    val sizeBytes: Long,
    /** Число файлов в архиве. */
    val fileCount: Int,
    /** Идентификатор опубликовавшего. */
    val publishedBy: String,
    /** Время публикации. */
    val publishedAt: Instant,
    /** Активен ли билд. */
    val active: Boolean,
)
