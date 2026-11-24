package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.dsbuilder.frontend.plugin.androidstudio.api.ApiRequestException
import com.dsbuilder.frontend.plugin.androidstudio.api.AuthenticatedApiClient
import com.dsbuilder.frontend.plugin.androidstudio.preview.objects
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import io.ktor.http.encodeURLParameter
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.Locale

internal fun normalizeStyleName(value: String): String =
    value.trim().replace(Regex("[-_\\s]"), "").lowercase(Locale.ROOT)

/** Однозначный поиск ссылки в опубликованном оформлении, без выбора первого совпадения. */
internal fun componentStyleReference(
    payload: JsonObject,
    styleName: String,
    selections: Map<
        String,
        String,
        >,
): String? {
    val styles = payload.objects("styles").filter {
        normalizeStyleName(it.text("styleName").orEmpty()) == normalizeStyleName(styleName)
    }
    val style = styles.singleOrNull() ?: return null
    val selected = normalizedProps(selections.entries.map { it.key to it.value }) ?: return null
    val matches = style.objects("variations").filter { variation ->
        normalizedProps(
            variation.objects("props").map {
                it.text("name").orEmpty() to it.text("value").orEmpty()
            },
        ) == selected
    }
    return matches.singleOrNull()?.text("composeReference")?.takeIf { it.isNotBlank() && it != "null" }
}

private fun normalizedProps(props: List<Pair<String, String>>): Map<String, String>? {
    val normalized = props.map { normalizeStyleName(it.first) to normalizeStyleName(it.second) }
    if (normalized.any { it.first.isBlank() || it.second.isBlank() }) return null
    if (normalized.map { it.first }.distinct().size != normalized.size) return null
    return normalized.toMap()
}

internal class ComponentStyleReferences(private val api: AuthenticatedApiClient) {
    suspend fun resolve(
        context: ComponentContext,
        componentKey: String,
        styleName: String,
        selections: Map<
            String,
            String,
            >,
    ): String? {
        val root = "/api/projects/${context.projectId.encodeURLParameter()}/documentation"
        return try {
            val active = ApiJson.parseToJsonElement(
                api.get(
                    "$root/publications/active?designSystemId=" +
                        "${context.designSystemId.encodeURLParameter()}&platform=compose",
                ),
            ) as JsonObject
            val publicationId = active.text("publicationId") ?: return null
            val subject = "components.$componentKey".encodeURLParameter()
            val bindingResponse = ApiJson.parseToJsonElement(
                api.get(
                    "$root/publications/${publicationId.encodeURLParameter()}/bindings" +
                        "?kind=component-style&subject=$subject&limit=2",
                ),
            ) as JsonObject
            val binding = bindingResponse.objects("items").singleOrNull() ?: return null
            val payload = bindingPayload(binding, "components.$componentKey")

            payload?.let { componentStyleReference(it, styleName, selections) }
        } catch (exception: ApiRequestException) {
            if (exception.statusCode == 404) null else throw exception
        }
    }
}

private fun bindingPayload(binding: JsonObject, subject: String): JsonObject? {
    if (binding.text("subject") != subject || binding.text("kind") != "component-style") return null
    return when (val value = binding["platformPayload"]) {
        is JsonObject -> value
        is JsonPrimitive -> ApiJson.parseToJsonElement(value.content) as JsonObject
        else -> null
    }
}
