package com.dsbuilder.ds.components.application

/** Команда загрузки каталога. */
data class PublishIconCatalog(
    /** Пакет-источник. */
    val packageName: String,
    /** Версия пакета-источника. */
    val packageVersion: String,
    /** Иконки. */
    val icons: List<IconUpload>,
    /** Только проверить и описать различия. */
    val dryRun: Boolean,
    /** Разрешить удаление иконок, на которые есть ссылки. */
    val allowRemovingUsed: Boolean,
)
