package com.dsbuilder.frontend.mcpserver

import kotlinx.serialization.Serializable

/** Typed wire envelopes and MCP projection DTOs. */
@Serializable
internal data class ProjectionEnvelope<T>(val source: String, val data: T)

@Serializable
internal data class BindingPageDto(val items: List<BindingDto>, val nextCursor: String? = null)

@Serializable
internal data class BindingDto(
    val id: String,
    val subject: String,
    val kind: String,
    val name: String,
    val platform: String,
)

@Serializable
internal data class BindingSummaryDto(
    val id: String,
    val subject: String,
    val kind: String,
    val name: String,
    val platform: String,
)

@Serializable
internal data class BindingSummaryPageDto(val items: List<BindingSummaryDto>, val nextCursor: String? = null)

@Serializable
internal data class KnowledgeChunkDto(
    val kbUrl: String,
    val publicationId: String,
    val designSystemId: String,
    val version: String,
    val platform: String,
    val pageId: String,
    val pagePath: String,
    val pageTitle: String,
    val contentId: String,
    val sourcePath: String,
    val ordinal: Int,
    val headingPath: List<String>,
    val markdown: String,
    val searchText: String,
    val subjects: List<String>,
)

@Serializable
internal data class KnowledgeChunkSummaryDto(
    val kbUrl: String,
    val publicationId: String,
    val designSystemId: String,
    val version: String,
    val platform: String,
    val pageId: String,
    val pagePath: String,
    val pageTitle: String,
    val contentId: String,
    val sourcePath: String,
    val ordinal: Int,
    val headingPath: List<String>,
    val markdown: String,
    val subjects: List<String>,
)

@Serializable
internal data class TokenSummaryDto(
    val id: String,
    val name: String,
    val type: String,
    val displayName: String? = null,
    val description: String? = null,
)

@Serializable
internal data class ComponentSummaryDto(
    val id: String,
    val name: String,
    val description: String? = null,
)

@Serializable
internal data class ComponentBindingDto<T>(
    val id: String,
    val subject: String,
    val kind: String,
    val name: String,
    val platform: String,
    val platformPayload: T,
)

@Serializable
internal data class ComponentBindingPayloadDto(
    val key: String,
    val coreName: String,
    val styles: List<ComponentStyleDto>,
)

@Serializable
internal data class ComponentStyleDto(
    val key: String,
    val coreName: String,
    val styleName: String,
    val props: List<ComponentPropertyDto> = emptyList(),
    val styleApi: StyleApiDto? = null,
    val variations: List<ComponentVariationDto>,
)

@Serializable
internal data class ComponentPropertyDto(
    val name: String,
    val values: List<String> = emptyList(),
    val defaultValue: String? = null,
)

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

@Serializable
internal data class ParameterValueDto(val value: String, val codeName: String? = null)

@Serializable
internal data class ComponentVariationDto(
    val name: String,
    val props: List<VariationPropertyDto> = emptyList(),
    val composeReference: String? = null,
    val viewReference: String? = null,
    val viewOverlayReference: String? = null,
    val reference: String? = null,
)

@Serializable
internal data class VariationPropertyDto(val name: String, val value: String)

@Serializable
internal data class ComponentBindingSummaryPayloadDto(
    val key: String,
    val coreName: String,
    val styles: List<ComponentStyleSummaryDto>,
    val totalVariationCount: Int,
)

@Serializable
internal data class ComponentStyleSummaryDto(
    val key: String,
    val coreName: String,
    val styleName: String,
    val props: List<ComponentPropertyDto> = emptyList(),
    val variationCount: Int,
)

@Serializable
internal data class ComponentBindingVariationsPayloadDto(
    val key: String,
    val coreName: String,
    val styles: List<ComponentStyleVariationsDto>,
    val totalVariationCount: Int,
)

@Serializable
internal data class ComponentStyleVariationsDto(
    val key: String,
    val coreName: String,
    val styleName: String,
    val props: List<ComponentPropertyDto> = emptyList(),
    val variations: List<ComponentVariationDto>,
    val variationCount: Int,
)
