package com.dsbuilder.ds.components.domain

/** Данные нового билда до записи. */
data class NewPluginBuild(
    /** Идентификатор билда. */
    val buildId: String,
    /** Платформа билда. */
    val platform: String,
    /** Версия `uikit-compose`. */
    val uikitComposeVersion: String,
    /** sha256 меты. */
    val metaSha256: String,
    /** Полный sha коммита. */
    val commit: String,
    /** Версия протокола. */
    val protocolVersion: Int,
    /** sha256 архива. */
    val zipSha256: String,
    /** Размер распакованного содержимого. */
    val sizeBytes: Long,
    /** Число файлов. */
    val fileCount: Int,
    /** Идентификатор опубликовавшего. */
    val publishedBy: String,
)
