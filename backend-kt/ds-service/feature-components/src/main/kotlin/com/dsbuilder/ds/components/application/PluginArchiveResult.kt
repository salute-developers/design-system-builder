package com.dsbuilder.ds.components.application

/** Результат чтения архива. */
sealed interface PluginArchiveResult {
    /** Архив прошёл проверки. */
    data class Valid(
        /** Распакованный архив. */
        val archive: PluginArchive,
    ) : PluginArchiveResult

    /** Архив не принят. */
    data class Invalid(
        /** Стабильный код причины. */
        val code: String,
        /** Описание для пользователя. */
        val message: String,
    ) : PluginArchiveResult
}
