package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.preview.jsonObject
import com.dsbuilder.frontend.plugin.androidstudio.preview.objects
import com.dsbuilder.frontend.plugin.androidstudio.preview.string
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import com.dsbuilder.frontend.plugin.androidstudio.preview.textOrNull
import io.ktor.http.encodeURLPathPart
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

/** То же разрешение legacyKey.size в SVG, что у каталога иконок веб-превью. */
internal fun previewIconAssets(catalog: JsonObject, values: List<String>): List<JsonObject> {
    val base = catalog.text("assetsBaseUrl")?.trimEnd('/')?.takeIf(String::isNotBlank) ?: return emptyList()
    return values.distinct().mapNotNull { value ->
        val key = value.substringBeforeLast('.', "")
        val size = value.substringAfterLast('.')
        if (size !in setOf("16", "24", "36")) return@mapNotNull null
        val icon = listOf(key, "$key.outline").firstNotNullOfOrNull { candidate ->
            catalog.objects("icons").firstOrNull {
                it.text("legacyKey") == candidate && (it["sizes"] as? JsonArray).orEmpty()
                    .any { entry -> entry.textOrNull() == size }
            }
        }
        icon?.text("name")?.let { name ->
            jsonObject(
                "id" to string("icon:$value"),
                "type" to string("SVG"),
                "url" to string("$base/$size/${name.encodeURLPathPart()}.svg"),
            )
        }
    }
}
