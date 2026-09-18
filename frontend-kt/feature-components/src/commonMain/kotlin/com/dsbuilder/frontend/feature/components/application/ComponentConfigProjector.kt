@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicFunction", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.components.application

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

public sealed interface ComponentConfigProjection {
    public data class Success(val value: ConfigPackageDto) : ComponentConfigProjection
    public data class InvalidSelection(val reason: String) : ComponentConfigProjection
}

public object ComponentConfigProjector {
    public fun project(
        value: ConfigPackageDto,
        selection: Map<String, String>,
        tokenNames: Set<String>? = null,
    ): ComponentConfigProjection {
        if (tokenNames != null && value.components.any {
                it.config.variations.map(VariationDto::id).toSet() != selection.keys
            }
        ) {
            return ComponentConfigProjection.InvalidSelection(
                "token-references requires a value for every variation axis",
            )
        }
        val components = mutableListOf<ConfiguredComponentDto>()
        for (component in value.components) {
            when (val selected = component.select(selection, tokenNames)) {
                is SelectedComponent.Success -> components += selected.value
                is SelectedComponent.Invalid -> return ComponentConfigProjection.InvalidSelection(selected.reason)
            }
        }
        return ComponentConfigProjection.Success(value.copy(components = components))
    }
}

private sealed interface SelectedComponent {
    data class Success(val value: ConfiguredComponentDto) : SelectedComponent

    data class Invalid(val reason: String) : SelectedComponent
}

private fun ConfiguredComponentDto.select(
    selection: Map<String, String>,
    tokenNames: Set<String>?,
): SelectedComponent {
    val unknown = selection.keys - config.variations.map(VariationDto::id).toSet()
    if (unknown.isNotEmpty()) return SelectedComponent.Invalid("Unknown variation axes: ${unknown.joinToString()}")

    val variations = mutableListOf<VariationDto>()
    for (variation in config.variations) {
        val requested = selection[variation.id]
        if (requested == null) {
            if (tokenNames == null) variations += variation
            continue
        }
        val values = variation.values.filter { it.name == requested && it.appliesTo(selection) }
        if (values.isEmpty()) {
            return SelectedComponent.Invalid("No applicable value $requested for variation ${variation.id}")
        }
        variations += variation.copy(values = values.map { it.withTokenReferencesOnly(tokenNames) })
    }
    val invariants = if (tokenNames == null) {
        config.invariants
    } else {
        config.invariants.mapNotNull { (name, property) ->
            property.knownTokenReferences(tokenNames)?.let { name to it }
        }.toMap()
    }
    val projected = config.copy(
        invariants = invariants,
        defaults = if (tokenNames == null) config.defaults else emptyList(),
        variations = variations,
    )
    return SelectedComponent.Success(copy(config = projected))
}

private fun VariationValueDto.appliesTo(selection: Map<String, String>): Boolean =
    targets.isNullOrEmpty() || targets.any { target ->
        target.properties.all { selection[it.id] == it.value.content }
    }

private fun VariationValueDto.withTokenReferencesOnly(tokenNames: Set<String>?): VariationValueDto {
    if (tokenNames == null) return this
    val references = properties.mapNotNull { (name, property) ->
        property.knownTokenReferences(tokenNames)?.let { name to it }
    }.toMap()
    return copy(properties = references)
}

private fun PropertyDto.knownTokenReferences(tokenNames: Set<String>): PropertyDto? {
    val tokenValue = value.takeIf { it.tokenName() in tokenNames }
    val tokenDefault = default.takeIf { it.tokenName() in tokenNames }
    val tokenStates = states.orEmpty().filter { it.value.tokenName() in tokenNames }
    if (tokenValue == null && tokenDefault == null && tokenStates.isEmpty()) return null
    return copy(value = tokenValue, default = tokenDefault, states = tokenStates.takeIf { it.isNotEmpty() })
}

private fun JsonElement?.tokenName(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull
