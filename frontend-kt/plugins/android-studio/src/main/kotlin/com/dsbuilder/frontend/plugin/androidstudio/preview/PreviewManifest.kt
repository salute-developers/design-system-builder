package com.dsbuilder.frontend.plugin.androidstudio.preview

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.net.URI

internal data class PreviewManifest(val entrypoint: URI, val components: Set<String>)

internal fun previewOrigin(uri: URI): String {
    require(
        uri.scheme in setOf(
            "http",
            "https",
        ) && uri.host != null && uri.userInfo == null,
    ) { "Некорректный адрес плагина превью" }
    return "${uri.scheme}://${uri.host}${if (uri.port == -1) "" else ":${uri.port}"}"
}

internal fun parsePreviewManifest(baseUrl: String, manifest: JsonObject): PreviewManifest {
    val base = URI(if (baseUrl.endsWith('/')) baseUrl else "$baseUrl/")
    val origin = previewOrigin(base)
    val compatible = manifest.text("schemaVersion") == "1" && manifest.text("protocolVersion") == "1" &&
        manifest.text("platform") == "compose"
    require(compatible) {
        "Несовместимый манифест Compose-превью"
    }
    val bridge = manifest.obj("payloadBridge")
    listOf("ready", "payload", "result", "describe", "description").forEach { type ->
        require(bridge.text("${type}MessageType") == "sdds.preview.$type") { "В манифесте отсутствует сообщение $type" }
    }
    val path = manifest.text("entrypoint")?.takeIf(String::isNotBlank) ?: error("Не задана точка входа")
    val entrypoint = base.resolve(path)
    require(previewOrigin(entrypoint) == origin) { "Точка входа находится на другом origin" }
    val raw = manifest["components"] as? JsonArray ?: error("Не задан список компонентов")
    val components = raw.map { requireNotNull(it.textOrNull()).also { value -> require(value.isNotBlank()) } }.toSet()
    return PreviewManifest(entrypoint, components)
}

/** Отдельный HTTP-клиент без токенов, cookie и автоматических перенаправлений. */
internal suspend fun loadPreviewManifest(http: HttpClient, baseUrl: String): PreviewManifest {
    val uri = URI(if (baseUrl.endsWith('/')) baseUrl else "$baseUrl/").resolve("preview-plugin.json")
    previewOrigin(uri)
    val response = http.get(uri.toString())
    check(response.status.value == 200) { "Манифест превью недоступен: HTTP ${response.status.value}" }
    return parsePreviewManifest(
        baseUrl,
        ApiJson.parseToJsonElement(response.bodyAsText()) as JsonObject,
    )
}
