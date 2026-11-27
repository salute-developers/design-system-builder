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
    constantSelections: Map<String, String> = emptyMap(),
): String? {
    val styles = payload.objects("styles").filter {
        normalizeStyleName(it.text("styleName").orEmpty()) == normalizeStyleName(styleName)
    }
    val style = styles.singleOrNull()
    val selected = normalizedProps(selections.entries.map { it.key to it.value }) ?: return null
    val constants = normalizedProps(constantSelections.entries.map { it.key to it.value }) ?: return null
    val variations = style?.objects("variations").orEmpty()
    val explicit = variations.filter { variationMatches(it, selected, constants) }
    val matches = if (explicit.isNotEmpty()) {
        explicit
    } else {
        val defaults = style?.let(::styleDefaults)
        variations.filter { defaults != null && variationMatches(it, selected, constants, defaults) }
    }
    return matches.singleOrNull()?.text("composeReference")?.takeIf { it.isNotBlank() && it != "null" }
}

private fun styleDefaults(style: JsonObject): Map<String, String>? {
    val props = style.objects("props")
    val names = props.map { normalizeStyleName(it.text("name").orEmpty()) }
    if (names.any(String::isBlank) || names.distinct().size != names.size) return null
    return normalizedProps(
        props.mapNotNull { prop -> prop.text("defaultValue")?.let { prop.text("name").orEmpty() to it } },
    )
}

private fun variationMatches(
    variation: JsonObject,
    selected: Map<String, String>,
    constants: Map<String, String>,
    defaults: Map<String, String> = emptyMap(),
): Boolean {
    val published = normalizedProps(
        variation.objects("props").map { it.text("name").orEmpty() to it.text("value").orEmpty() },
    ) ?: return false
    val resolved = defaults + published
    return resolved.none { (name, value) -> name in constants && constants[name] != value } &&
        constants + resolved == selected
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
        configuration: ComponentConfiguration,
        selections: Map<
            String,
            String,
            >,
    ): String? {
        val componentKey = configuration.componentName
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

            payload?.let {
                componentStyleReference(it, configuration.styleName, selections, configuration.constantSelections())
            }
        } catch (exception: ApiRequestException) {
            if (exception.statusCode == 404) null else throw exception
        }
    }
}

/** В публикации могут отсутствовать оси экспорта с единственным допустимым значением. */
private fun ComponentConfiguration.constantSelections(): Map<String, String> = axes().mapNotNull { axis ->
    val name = axis.text("name") ?: return@mapNotNull null
    axisValues(axis).singleOrNull()?.text("name")?.let { name to it }
}.toMap()

private fun bindingPayload(binding: JsonObject, subject: String): JsonObject? {
    if (binding.text("subject") != subject || binding.text("kind") != "component-style") return null
    return when (val value = binding["platformPayload"]) {
        is JsonObject -> value
        is JsonPrimitive -> ApiJson.parseToJsonElement(value.content) as JsonObject
        else -> null
    }
}
