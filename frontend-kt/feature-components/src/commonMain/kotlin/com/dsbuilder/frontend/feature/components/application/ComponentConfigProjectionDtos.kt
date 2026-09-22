@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.components.application

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

/** Common-config export DTOs shared by application projection and MCP serialization. */
@Serializable
public data class ConfigPackageDto(
    val meta: JsonElement,
    val components: List<ConfiguredComponentDto>,
    val underivedTypes: List<String> = emptyList(),
)

@Serializable
public data class ConfiguredComponentDto(
    val componentName: String,
    val styleName: String,
    val config: ComponentConfigDto,
)

@Serializable
public data class ComponentConfigDto(
    val rootVariationId: String? = null,
    val colorSchemeVariationId: String? = null,
    val invariants: Map<String, PropertyDto> = emptyMap(),
    val defaults: List<JsonElement> = emptyList(),
    val variations: List<VariationDto> = emptyList(),
)

@Serializable
public data class VariationDto(
    val id: String,
    val name: String? = null,
    val declaredType: String? = null,
    val values: List<VariationValueDto> = emptyList(),
)

@Serializable
public data class VariationValueDto(
    val name: String,
    val targets: List<TargetDto>? = null,
    val properties: Map<String, PropertyDto> = emptyMap(),
    val authoredId: String? = null,
)

@Serializable
public data class TargetDto(val properties: List<TargetPropertyDto> = emptyList())

@Serializable
public data class TargetPropertyDto(val id: String, val value: JsonPrimitive)

@Serializable
public data class PropertyDto(
    val type: String,
    val value: JsonElement? = null,
    val default: JsonElement? = null,
    val alpha: JsonElement? = null,
    val adjustment: JsonElement? = null,
    val states: List<PropertyStateDto>? = null,
)

@Serializable
public data class PropertyStateDto(
    @SerialName("state") val states: List<String> = emptyList(),
    val value: JsonElement? = null,
    val alpha: JsonElement? = null,
    val type: String? = null,
)
