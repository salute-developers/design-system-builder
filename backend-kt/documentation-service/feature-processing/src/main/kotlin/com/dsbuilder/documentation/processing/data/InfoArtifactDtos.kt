package com.dsbuilder.documentation.processing.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Входной component info artifact. */
@Serializable
internal data class ComponentInfoDto(
    val name: String? = null,
    val packageName: String? = null,
    val components: List<ComponentDto>,
)

/** Входной component. */
@Serializable
internal data class ComponentDto(
    val key: String,
    val coreName: String,
    val styleName: String,
    val props: List<ComponentPropertyDto> = emptyList(),
    val styleApi: StyleApiDto? = null,
    val variations: List<ComponentVariationDto>,
)

/** Описание component property. */
@Serializable
internal data class ComponentPropertyDto(
    val name: String,
    val values: List<String> = emptyList(),
    val defaultValue: String? = null,
)

/** Platform style API. */
@Serializable
internal data class StyleApiDto(
    val holderName: String? = null,
    val packageName: String? = null,
    val stylesClassName: String? = null,
    val stylesClassQualifiedName: String? = null,
    val receiverClassName: String? = null,
    val receiverClassQualifiedName: String? = null,
    val returnTypeName: String? = null,
    val returnTypeQualifiedName: String? = null,
    val modifyReceiverTypeName: String? = null,
    val modifyReceiverTypeQualifiedName: String? = null,
    val params: List<StyleParameterDto> = emptyList(),
)

/** Parameter style API. */
@Serializable
internal data class StyleParameterDto(
    val name: String,
    val type: String,
    val required: Boolean? = null,
    val typeName: String? = null,
    val typeQualifiedName: String? = null,
    val defaultValue: ParameterValueDto? = null,
    val values: List<ParameterValueDto> = emptyList(),
)

/** Значение style parameter. */
@Serializable
internal data class ParameterValueDto(
    val value: String,
    val codeName: String? = null,
)

/** Component variation всех поддерживаемых platforms. */
@Serializable
internal data class ComponentVariationDto(
    val name: String,
    val props: List<VariationPropertyDto> = emptyList(),
    val composeReference: String? = null,
    val viewReference: String? = null,
    val viewOverlayReference: String? = null,
    val reference: String? = null,
)

/** Значение property variation. */
@Serializable
internal data class VariationPropertyDto(val name: String, val value: String)

/** Входной theme info artifact. */
@Serializable
internal data class ThemeInfoDto(
    val name: String,
    val version: String,
    val platform: String? = null,
    val tokens: List<ThemeTokenDto>,
)

/** Входной theme token. */
@Serializable
internal data class ThemeTokenDto(
    val type: String,
    val name: String,
    val displayName: String? = null,
    val description: String? = null,
    val value: JsonElement,
    val reference: String? = null,
    val themeReference: String? = null,
    val tenant: String? = null,
    val theme: String? = null,
)

/** Нормализованный payload одного component subject со всеми style holders. */
@Serializable
internal data class ComponentBindingPayload(
    val key: String,
    val coreName: String,
    val styles: List<ComponentDto>,
)

/** Нормализованный payload одного token subject, включая многослойные значения. */
@Serializable
internal data class ThemeTokenBindingPayload(
    val type: String,
    val name: String,
    val displayName: String? = null,
    val description: String? = null,
    val values: List<JsonElement>,
    val reference: String? = null,
    val themeReference: String? = null,
    val tenant: String? = null,
    val theme: String? = null,
)
