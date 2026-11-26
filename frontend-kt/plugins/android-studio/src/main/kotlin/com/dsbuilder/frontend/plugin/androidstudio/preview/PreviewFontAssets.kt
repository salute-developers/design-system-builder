package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.net.URI
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

internal data class PreviewFontResource(val bytes: ByteArray, val mimeType: String)

/** Анонимная загрузка шрифтов в JVM; iframe получает только адреса своего origin и готовые bytes. */
internal class PreviewFontAssets(
    private val base: URI,
    private val downloader: PreviewFontDownloader = PreviewFontDownloader(),
) : AutoCloseable {
    private val resources = ConcurrentHashMap<String, PreviewFontResource>()
    private val mutex = Mutex()
    private var usedBytes = 0

    @Volatile
    private var closed = false

    suspend fun prepare(payload: JsonObject): JsonObject {
        check(!closed) { "Сессия превью закрыта" }
        val assets = payload.objects("assets").map { asset ->
            val type = asset.text("type")
            if (type !in setOf("TTF", "OTF")) return@map asset
            val url = requireNotNull(asset.text("url")) { "Нет адреса шрифта" }
            val uri = URI(url)
            if (!uri.isAbsolute || previewOrigin(uri) == previewOrigin(base)) return@map asset
            require(uri.scheme == "https" && uri.userInfo == null) { "Шрифт должен иметь публичный HTTPS-адрес" }
            val local = cache(url, requireNotNull(type))
            JsonObject(asset + ("url" to string(local)))
        }
        val theme = payload.obj("theme").mapValues { (_, raw) ->
            val value = raw as? JsonObject
            if (value?.text("type") == "fontFamily" && value.objects("faces").isNotEmpty()) {
                JsonObject(value + ("allowFallback" to JsonPrimitive(false)))
            } else {
                raw
            }
        }
        return JsonObject(payload + mapOf("assets" to JsonArray(assets), "theme" to JsonObject(theme)))
    }

    private suspend fun cache(url: String, type: String): String = mutex.withLock {
        check(!closed) { "Сессия превью закрыта" }
        val hash = MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
        val local = base.resolve("$hash.${type.lowercase()}").toString()
        if (!resources.containsKey(local)) {
            check(resources.size < MAX_FILES) { "Слишком много файлов шрифтов" }
            val bytes = downloader.download(url)
            check(
                bytes.size <= PreviewFontDownloader.MAX_FONT_BYTES && validFont(bytes, type),
            ) { "Некорректный файл шрифта" }
            synchronized(resources) {
                check(!closed && usedBytes + bytes.size <= MAX_TOTAL_BYTES) { "Превышен лимит памяти шрифтов" }
                resources[local] = PreviewFontResource(bytes, if (type == "OTF") "font/otf" else "font/ttf")
                usedBytes += bytes.size
            }
        }
        local
    }

    fun resource(url: String): PreviewFontResource? = resources[url]

    override fun close() {
        synchronized(resources) {
            closed = true
            resources.clear()
        }
        downloader.close()
    }

    private companion object {
        const val MAX_TOTAL_BYTES = 32 * 1024 * 1024
        const val MAX_FILES = 128
    }
}

private fun validFont(bytes: ByteArray, type: String): Boolean {
    if (bytes.size < 12) return false
    return if (type == "OTF") {
        bytes.take(4).toByteArray().contentEquals("OTTO".toByteArray())
    } else {
        bytes[0] == 0.toByte() && bytes[1] == 1.toByte() && bytes[2] == 0.toByte() && bytes[3] == 0.toByte()
    }
}
