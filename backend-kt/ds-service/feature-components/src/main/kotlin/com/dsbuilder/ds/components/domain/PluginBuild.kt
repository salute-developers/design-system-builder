package com.dsbuilder.ds.components.domain

import java.time.Instant

/** Опубликованный билд Compose preview plugin. */
data class PluginBuild(
    /** Идентификатор билда: первые 12 символов `commit`. */
    val buildId: String,
    /** Платформа билда (`compose`). */
    val platform: String,
    /** Версия `uikit-compose`, из которой собран плагин и его мета. */
    val uikitComposeVersion: String,
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
