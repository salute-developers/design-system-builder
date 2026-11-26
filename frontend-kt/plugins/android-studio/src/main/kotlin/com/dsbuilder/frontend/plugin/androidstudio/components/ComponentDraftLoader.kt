package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.preview.ComponentPreviewDraft
import com.dsbuilder.frontend.plugin.androidstudio.preview.PreviewAssemblyException
import com.dsbuilder.frontend.plugin.androidstudio.preview.PreviewTokenResolver
import com.dsbuilder.frontend.plugin.androidstudio.preview.failAssembly
import com.dsbuilder.frontend.plugin.androidstudio.preview.jsonObject
import com.dsbuilder.frontend.plugin.androidstudio.preview.obj
import com.dsbuilder.frontend.plugin.androidstudio.preview.objects
import com.dsbuilder.frontend.plugin.androidstudio.preview.previewSurfaceBackground
import com.dsbuilder.frontend.plugin.androidstudio.preview.string
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import com.dsbuilder.frontend.plugin.androidstudio.preview.textOrNull
import kotlinx.coroutines.CoroutineScope
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Кеш одного раздела и одного контекста; закрытие scope отменяет незавершённые чтения. */
internal class ComponentDraftLoader(
    private val catalog: ComponentCatalog,
    private val context: ComponentContext,
    private val scope: CoroutineScope,
    private val components: List<CatalogComponent>,
) {
    private val bundles = ComponentReadCache<ComponentBundle>(scope)
    private val tokens = ComponentReadCache<Pair<List<JsonObject>, List<JsonObject>>>(scope)
    private val appearances = ComponentReadCache<List<JsonObject>>(scope)
    private val iconCatalog = ComponentReadCache<JsonObject>(scope)

    suspend fun bundle(component: CatalogComponent): ComponentBundle =
        bundles.get(component.id) { catalog.bundle(context, component) }

    /** Прогревает шрифт общего text-default до выбора первого компонента. */
    suspend fun defaultFontPayload(): JsonObject {
        val themeTokens = projectTokens(tokens.get("tokens") { catalog.tokens(context) }, context, "light")
        val resolver = PreviewTokenResolver(
            jsonObject(
                "themeMode" to string("light"),
                "themeTokens" to JsonArray(themeTokens),
            ),
        )
        try {
            resolver.resolve("body.m.normal")
        } catch (_: PreviewAssemblyException) {
            // Не каждая ДС содержит общий text-default; её компоненты собираются обычным путём.
            return jsonObject()
        }
        return jsonObject("assets" to JsonArray(resolver.assets.values.toList()), "theme" to JsonObject(resolver.theme))
    }

    private suspend fun target(reference: String): Pair<ComponentBundle, ComponentConfiguration> {
        val name = reference.substringBefore('.')
        val ids = appearances.get("appearances") { catalog.appearances(context) }
            .filter { it.text("name") == name }.mapNotNull { it.text("componentId") }.toSet()
        val matches = components.filter { it.id in ids }.flatMap { candidate ->
            val targetBundle = bundle(candidate)
            targetBundle.configurations.filter { it.styleName == name }.map { targetBundle to it }
        }
        return matches.singleOrNull()
            ?: failAssembly(
                "invalid_reference",
                reference,
                "Цель ссылки отсутствует или неоднозначна",
            )
    }

    suspend fun draft(
        bundle: ComponentBundle,
        configuration: ComponentConfiguration,
        selections: Map<String, String>,
        mode: String,
        storyId: String,
        exampleProps: JsonObject = JsonObject(emptyMap()),
    ): ComponentPreviewDraft {
        val projection = ComponentPropertyDrafts(::target)
        val selected = projection.properties(
            bundle,
            configuration.selectedProperties(selections),
            emptyList(),
        )
        val invariants = projection.properties(
            bundle,
            configuration.config.obj("invariants"),
            emptyList(),
        )
        val defaults = projection.defaults()
        val iconValues = (selected + invariants + projection.styles.values.flatMap { it.objects("properties") })
            .filter { it.text("type") == "icon" }.flatMap { property ->
                listOfNotNull(property.text("value")) + property.objects("states").mapNotNull { it.text("value") }
            }.filter(String::isNotBlank)
        val assets = if (iconValues.isEmpty()) {
            emptyList()
        } else {
            previewIconAssets(iconCatalog.get("icons") { catalog.icons(context) }, iconValues)
        }
        val themeTokens = projectTokens(
            tokens.get("tokens") { catalog.tokens(context) },
            context,
            mode,
        )
        return ComponentPreviewDraft(
            jsonObject(
                "componentId" to string(bundle.component.name), "storyId" to string(storyId),
                "rendererPlatform" to string("COMPOSE"),
                "themeValuePlatform" to string("android"),
                "themeMode" to string(mode),
                "variationSelections" to JsonObject(selections.mapValues { string(it.value) }),
                "invariantProperties" to JsonArray(invariants),
                "selectedStyleProperties" to JsonArray(selected),
                "styles" to JsonArray(projection.styles.values.toList()),
                "defaults" to defaults,
                "themeTokens" to JsonArray(themeTokens),
                "assets" to JsonArray(assets),
                "example" to jsonObject("id" to string(storyId), "props" to exampleProps),
                "surface" to jsonObject(
                    "width" to JsonPrimitive(500),
                    "height" to JsonPrimitive(350),
                    "background" to string(previewSurfaceBackground(mode)),
                ),
            ),
        )
    }
}

private class ComponentPropertyDrafts(
    private val target: suspend (String) -> Pair<ComponentBundle, ComponentConfiguration>,
) {
    val styles = linkedMapOf<String, JsonObject>()
    suspend fun properties(
        owner: ComponentBundle,
        values: JsonObject,
        trail: List<String>,
    ): List<JsonObject> =
        values.map { (name, raw) ->
            val property = raw as JsonObject
            val mapping = owner.hasComposeMapping(name)
            val value = property["default"] ?: property["value"]
            val base = jsonObject(
                "id" to string(name), "name" to string(name), "type" to property["type"],
                "value" to value?.takeUnless { it == JsonNull }, "alpha" to property["alpha"],
                "adjustment" to property["adjustment"],
                "composeParameters" to JsonArray(if (mapping.first) listOf(string(name)) else emptyList()),
                "hasNonComposeMappings" to JsonPrimitive(mapping.second),
                "states" to JsonArray(
                    property.objects("states").map { state ->
                        jsonObject(
                            "names" to state["state"],
                            "value" to state["value"],
                            "alpha" to state["alpha"],
                        )
                    },
                ),
            )
            if (property.text("type") != "component_style") return@map base
            val reference = value?.textOrNull().orEmpty()
            collectStyle(reference, trail)
            val states = base.objects("states").map { state ->
                val stateReference = state.text("value")?.takeIf(String::isNotBlank) ?: return@map state
                collectStyle(stateReference, trail)
                JsonObject((state - "value") + ("styleRef" to string(stateReference)))
            }
            JsonObject((base - "value") + mapOf("styleRef" to string(reference), "states" to JsonArray(states)))
        }

    private suspend fun collectStyle(reference: String, trail: List<String>) {
        if (reference in trail || trail.size >= 5) {
            failAssembly(
                "cycle",
                reference,
                "Цикл или предел глубины ссылки",
            )
        }
        // Кеш HTTP сохраняется, но глубина проверяется заново для каждого пути.
        val parts = reference.split('.')
        val target = target(reference)
        val targetSelections = referenceSelections(target.second, parts.drop(1))
        val selectedTarget = target.second.selectedProperties(targetSelections)
        val values = JsonObject(target.second.config.obj("invariants") + selectedTarget)
        val nested = properties(target.first, values, trail + reference)
        styles[reference] = jsonObject(
            "id" to string(reference),
            "componentId" to string(target.first.component.name),
            "properties" to JsonArray(nested),
        )
    }

    suspend fun defaults(): JsonObject {
        val references = mapOf(
            "button" to "basic-button.m.default",
            "switch" to "switch.s",
            "spinner" to "spinner.xs.default",
        )
        val available = references.mapNotNull { (kind, reference) ->
            try {
                collectStyle(reference, emptyList())
                kind to string(reference)
            } catch (_: PreviewAssemblyException) {
                null
            }
        }.toMap()
        return jsonObject(
            "text" to jsonObject(
                "style" to string("body.m.normal"),
                "color" to string("text.default.primary"),
            ),
            "styles" to JsonObject(available),
        )
    }
}

private fun projectTokens(
    source: Pair<List<JsonObject>, List<JsonObject>>,
    context: ComponentContext,
    mode: String,
): List<JsonObject> {
    val (definitions, values) = source
    return definitions.map { definition ->
        val tokenValues = values.filter {
            it.text("tokenId") == definition.text("id") && it.text("platform") == "android" &&
                (it.text("tenantId") == null || it.text("tenantId") == context.tenantId)
        }
        val value = tokenValues.singleOrNull { it.text("mode") == mode }
            ?: tokenValues.singleOrNull { it.text("mode") == null }
        val type = if (definition.text("type") == "spacing") "dimension" else definition.text("type").orEmpty()
        val raw = value?.get("value")
        val normalized = if (type !in setOf(
                "shadow",
                "gradient",
            ) && raw is JsonArray && raw.size == 1
        ) {
            raw[0]
        } else {
            raw
        }
        jsonObject(
            "id" to definition["name"],
            "type" to string(type),
            "enabled" to (definition["enabled"] ?: JsonPrimitive(true)),
            "values" to jsonObject("android" to normalized),
        )
    }
}
