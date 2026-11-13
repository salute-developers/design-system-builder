package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.application.sha256Hex
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.Base64
import java.util.zip.ZipInputStream

/** Multipart fixture carries coordinates separately and hashes the unchanged archived bytes. */
internal fun releaseMetaBody(body: String, archive: ByteArray): String {
    val files = runCatching {
        ZipInputStream(archive.inputStream()).use { zip ->
            buildMap {
                while (true) {
                    val entry = zip.nextEntry ?: break
                    put(entry.name, zip.readBytes())
                }
            }
        }
    }.getOrDefault(emptyMap())
    val manifest = files["preview-plugin.json"]?.let { Json.parseToJsonElement(it.decodeToString()).jsonObject }
    val request = Json.parseToJsonElement(body).jsonObject
    val platform = request.getValue("platform").jsonPrimitive.content
    val source = files["api-meta.json"] ?: "[]".toByteArray()
    val coordinates = manifest?.get("coreRelease") ?: Json.parseToJsonElement(
        """{"libraryId":"fixture-$platform","platform":"$platform","version":"0.0.0"}""",
    )
    return JsonObject(
        request + mapOf(
            "coreRelease" to coordinates,
            "sourceMetaBase64" to JsonPrimitive(Base64.getEncoder().encodeToString(source)),
            "metaSha256" to JsonPrimitive(sha256Hex(source)),
        ),
    ).toString()
}
