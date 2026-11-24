package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.dsbuilder.frontend.plugin.androidstudio.api.AuthenticatedApiClient
import com.dsbuilder.frontend.plugin.androidstudio.preview.obj
import com.dsbuilder.frontend.plugin.androidstudio.preview.objects
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import io.ktor.http.encodeURLParameter
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

internal data class ComponentContext(
    val projectId: String,
    val designSystemId: String,
    val tenantId: String,
    val versionId: String? = null,
) {
    val root: String get() = "/api/projects/${projectId.encodeURLParameter()}/design-systems"
    val designSystemRoot: String get() = "$root/${designSystemId.encodeURLParameter()}"
    fun readPath(path: String): String = versionId?.let {
        path + (if ('?' in path) "&" else "?") + "versionId=${it.encodeURLParameter()}"
    } ?: path
}

internal data class CatalogComponent(
    val id: String,
    val name: String,
    val appearanceNames: List<String> = emptyList(),
)

internal data class ComponentConfiguration(
    val componentName: String,
    val styleName: String,
    val config: JsonObject,
)

internal data class ComponentBundle(val component: CatalogComponent, val data: JsonObject) {
    val configurations: List<ComponentConfiguration> = data.obj("export").objects("components").map {
        ComponentConfiguration(
            requireNotNull(it.text("componentName")),
            requireNotNull(it.text("styleName")),
            it.obj("config"),
        )
    }
    fun hasComposeMapping(name: String): Pair<Boolean, Boolean> {
        val id = data.objects("properties").singleOrNull { it.text("name") == name }?.text("id")
        val params = data.objects("platformParams").filter { it.text("propertyId") == id }
        return params.any { it.text("platform") == "compose" } to params.any { it.text("platform") != "compose" }
    }
}

/** Клиент только чтения: публичные маршруты шлюза включают контекст проекта. */
internal class ComponentCatalog(private val api: AuthenticatedApiClient) {
    suspend fun list(context: ComponentContext): List<CatalogComponent> {
        val result = linkedMapOf<String, CatalogComponent>()
        val seenCursors = mutableSetOf<String>()
        var cursor: String? = null
        do {
            val suffix = cursor?.let { "&cursor=${it.encodeURLParameter()}" }.orEmpty()
            val response = api.getResponse(
                context.readPath(
                    "${context.designSystemRoot}/components?platform=compose&limit=100$suffix",
                ),
            )
            check(response.readHeadersValid) { "Неоднозначные метаданные списка компонентов" }
            val values = ApiJson.parseToJsonElement(response.body) as JsonArray
            values.map { it as JsonObject }.filter { it.text("platform") in setOf(null, "compose") }.forEach {
                val id = requireNotNull(it.text("id"))
                result[id] = CatalogComponent(id, requireNotNull(it.text("name")))
            }
            cursor = response.headers["x-ds-next-cursor"]?.takeIf(String::isNotBlank)
            check(cursor == null || seenCursors.add(cursor)) { "Повторяющийся курсор списка компонентов" }
        } while (cursor != null)
        return result.values.sortedBy { it.name }
    }

    suspend fun bundle(context: ComponentContext, component: CatalogComponent): ComponentBundle {
        val path = "${context.designSystemRoot}/components/${component.id.encodeURLParameter()}"
        val body = api.get(context.readPath("$path/editor-bundle?platform=compose"))
        val data = ApiJson.parseToJsonElement(body) as JsonObject
        check(data.obj("component").text("id") == component.id && data.obj("component").text("platform") == "compose") {
            "Ответ относится к другому компоненту или платформе"
        }
        return ComponentBundle(component, data)
    }

    suspend fun appearances(context: ComponentContext): List<JsonObject> =
        (ApiJson.parseToJsonElement(api.get(context.readPath("${context.designSystemRoot}/appearances"))) as JsonArray)
            .map { it as JsonObject }

    suspend fun icons(context: ComponentContext): JsonObject =
        ApiJson.parseToJsonElement(api.get("${context.root}/catalog/icons")) as JsonObject

    suspend fun tokens(context: ComponentContext): Pair<List<JsonObject>, List<JsonObject>> {
        val definitions = ApiJson.parseToJsonElement(
            api.get(context.readPath("${context.designSystemRoot}/tokens")),
        ) as JsonArray
        val tenantPath = "${context.designSystemRoot}/tenants/${context.tenantId.encodeURLParameter()}"
        val values = ApiJson.parseToJsonElement(
            api.get(context.readPath("$tenantPath/token-values?platforms=android")),
        ) as JsonArray
        return definitions.map { it as JsonObject } to values.map { it as JsonObject }
    }

    suspend fun pluginUrl(context: ComponentContext): String = requireNotNull(
        (
            ApiJson.parseToJsonElement(
                api.get("${context.root}/catalog/compose-preview/plugin"),
            ) as JsonObject
            ).text("pluginUrl"),
    ) { "Плагин превью не опубликован" }
}
