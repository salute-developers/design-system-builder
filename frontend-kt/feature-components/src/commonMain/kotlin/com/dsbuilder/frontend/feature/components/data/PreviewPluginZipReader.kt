package com.dsbuilder.frontend.feature.components.data

/** Содержимое архива плагина, нужное команде публикации. */
internal class PreviewPluginZipContent(
    val zipBytes: ByteArray,
    val manifest: ByteArray,
    val meta: ByteArray,
)

/** Результат чтения zip. */
internal sealed interface PreviewPluginZipRead {
    /** Прочитан архив с обоими файлами. */
    data class Content(val value: PreviewPluginZipContent) : PreviewPluginZipRead

    /** Архив не прочитан; [message] детерминированно для вывода CLI. */
    data class Failed(val message: String) : PreviewPluginZipRead
}

/** Читает из zip-архива `preview-plugin.json` и `api-meta.json`; реализации зависят от платформы. */
internal expect class PreviewPluginZipReader() {
    /** Читает архив по абсолютному пути [path]. */
    fun read(path: String): PreviewPluginZipRead
}
