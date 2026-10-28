package com.dsbuilder.ds.components.application

/** Явная таблица типов содержимого файлов плагина: определение по содержимому не используется. */
object PluginContentTypes {
    /** `Cache-Control` файлов билда: каталог содержит идентификатор билда и не меняется. */
    const val IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"

    private const val FALLBACK = "application/octet-stream"
    private val byExtension = mapOf(
        "wasm" to "application/wasm",
        "js" to "text/javascript; charset=utf-8",
        "mjs" to "text/javascript; charset=utf-8",
        "html" to "text/html; charset=utf-8",
        "json" to "application/json; charset=utf-8",
        "css" to "text/css; charset=utf-8",
        "txt" to "text/plain; charset=utf-8",
        "xml" to "application/xml",
        "svg" to "image/svg+xml",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "webp" to "image/webp",
        "gif" to "image/gif",
        "otf" to "font/otf",
        "ttf" to "font/ttf",
        "woff" to "font/woff",
        "woff2" to "font/woff2",
        "map" to "application/json; charset=utf-8",
    )

    /** Тип содержимого для [path] по расширению. */
    fun forPath(path: String): String =
        path.substringAfterLast('/').substringAfterLast('.', "").lowercase().let { byExtension[it] ?: FALLBACK }
}
