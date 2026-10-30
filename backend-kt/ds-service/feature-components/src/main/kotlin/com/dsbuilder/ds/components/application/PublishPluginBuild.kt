package com.dsbuilder.ds.components.application

/** Публикация билда плагина: архив и нормализованная мета одной операцией. */
class PublishPluginBuild(
    /** Байты zip-архива плагина. */
    val archive: ByteArray,
    /** Нормализованная мета платформы публикации из того же билда. */
    val meta: ImportApiMeta,
    /** Выполнить всё, кроме записи: проверки и пробный импорт меты. */
    val dryRun: Boolean,
)
