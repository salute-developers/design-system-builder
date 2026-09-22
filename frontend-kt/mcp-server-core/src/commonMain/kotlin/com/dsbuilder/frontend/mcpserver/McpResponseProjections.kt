package com.dsbuilder.frontend.mcpserver

import kotlinx.serialization.json.Json

/** Search returns metadata; code_binding_get applies the explicitly requested response detail. */
internal fun compactBindingSearch(json: Json, result: McpToolResult): McpToolResult {
    if (result.isError) return result
    val codec = projectionJson(json)
    val wire = runCatching { codec.decodeFromString<ProjectionEnvelope<BindingPageDto>>(result.body) }
        .getOrNull() ?: return result
    val page = BindingSummaryPageDto(wire.data.items.map(BindingDto::summary), wire.data.nextCursor)
    return result.copy(body = codec.encodeToString(ProjectionEnvelope(wire.source, page)))
}

/** Removes the plain-text search index copy while retaining published markdown and source metadata. */
@Suppress("ReturnCount")
internal fun compactDocumentationFetch(json: Json, result: McpToolResult): McpToolResult {
    if (result.isError) return result
    val codec = projectionJson(json)
    val envelope = runCatching { codec.decodeFromString<ProjectionEnvelope<KnowledgeChunkDto>>(result.body) }
        .getOrNull() ?: return result
    return result.copy(body = codec.encodeToString(ProjectionEnvelope(envelope.source, envelope.data.summary())))
}

internal fun compactTokenList(
    result: McpToolResult,
    json: Json,
    exactName: String?,
    limit: Int?,
): McpToolResult = compactNamedList(
    result,
    json,
    exactName,
    limit,
)

internal fun compactComponentList(
    result: McpToolResult,
    json: Json,
    exactName: String?,
    limit: Int?,
): McpToolResult {
    if (result.isError) return result
    val codec = projectionJson(json)
    val envelope = runCatching { codec.decodeFromString<ProjectionEnvelope<List<ComponentSummaryDto>>>(result.body) }
        .getOrNull() ?: return result
    val items = envelope.data.filtered(exactName, limit, ComponentSummaryDto::name)
    return result.copy(body = codec.encodeToString(ProjectionEnvelope(envelope.source, items)))
}

@Suppress("ReturnCount")
private fun compactNamedList(
    result: McpToolResult,
    json: Json,
    exactName: String?,
    limit: Int?,
): McpToolResult {
    if (result.isError) return result
    val codec = projectionJson(json)
    val envelope = runCatching { codec.decodeFromString<ProjectionEnvelope<List<TokenSummaryDto>>>(result.body) }
        .getOrNull() ?: return result
    val items = envelope.data.filtered(exactName, limit, TokenSummaryDto::name)
    return result.copy(body = codec.encodeToString(ProjectionEnvelope(envelope.source, items)))
}

internal enum class CodeBindingDetail(val wireValue: String) {
    SUMMARY("summary"),
    VARIATIONS("variations"),
    FULL("full"),
    ;

    internal companion object {
        fun parse(value: String): CodeBindingDetail? = entries.singleOrNull { it.wireValue == value }
    }
}

/** Projects a component binding through explicit platform DTOs. */
@Suppress("ReturnCount")
internal fun projectComponentBinding(
    result: McpToolResult,
    json: Json,
    appearanceNames: Set<String>,
    variationNames: Set<String>,
    detail: CodeBindingDetail,
): McpToolResult {
    if (result.isError) return result
    if (detail == CodeBindingDetail.FULL && appearanceNames.isEmpty() && variationNames.isEmpty()) return result
    val codec = projectionJson(json)
    val envelope = runCatching {
        codec.decodeFromString<ProjectionEnvelope<ComponentBindingDto<ComponentBindingPayloadDto>>>(result.body)
    }.getOrNull() ?: return result
    val binding = envelope.data
    val styles = binding.platformPayload.styles.filter { appearanceNames.isEmpty() || it.styleName in appearanceNames }
    val body = when (detail) {
        CodeBindingDetail.SUMMARY ->
            codec.encodeToString(ProjectionEnvelope(envelope.source, binding.toSummary(styles)))
        CodeBindingDetail.VARIATIONS ->
            codec.encodeToString(ProjectionEnvelope(envelope.source, binding.toVariations(styles, variationNames)))
        CodeBindingDetail.FULL ->
            codec.encodeToString(ProjectionEnvelope(envelope.source, binding.toFull(styles, variationNames)))
    }
    return result.copy(body = body)
}

private fun BindingDto.summary() = BindingSummaryDto(id, subject, kind, name, platform)

private fun KnowledgeChunkDto.summary() = KnowledgeChunkSummaryDto(
    kbUrl,
    publicationId,
    designSystemId,
    version,
    platform,
    pageId,
    pagePath,
    pageTitle,
    contentId,
    sourcePath,
    ordinal,
    headingPath,
    markdown,
    subjects,
)

private fun <T> List<T>.filtered(exactName: String?, limit: Int?, nameOf: (T) -> String): List<T> =
    (exactName?.let { name -> filter { nameOf(it) == name } } ?: this)
        .let { items -> limit?.takeIf { it > 0 }?.let(items::take) ?: items }

private fun ComponentBindingDto<ComponentBindingPayloadDto>.toSummary(
    styles: List<ComponentStyleDto>,
): ComponentBindingDto<ComponentBindingSummaryPayloadDto> = copyWithPayload(
    ComponentBindingSummaryPayloadDto(
        key = platformPayload.key,
        coreName = platformPayload.coreName,
        styles = styles.map { style ->
            ComponentStyleSummaryDto(
                key = style.key,
                coreName = style.coreName,
                styleName = style.styleName,
                props = style.props,
                variationCount = style.variations.size,
            )
        },
        totalVariationCount = styles.sumOf { it.variations.size },
    ),
)

private fun ComponentBindingDto<ComponentBindingPayloadDto>.toVariations(
    styles: List<ComponentStyleDto>,
    variationNames: Set<String>,
): ComponentBindingDto<ComponentBindingVariationsPayloadDto> {
    val projected = styles.map { style ->
        val variations = style.variations.selectNamed(variationNames)
        ComponentStyleVariationsDto(
            key = style.key,
            coreName = style.coreName,
            styleName = style.styleName,
            props = style.props,
            variations = variations,
            variationCount = variations.size,
        )
    }
    return copyWithPayload(
        ComponentBindingVariationsPayloadDto(
            key = platformPayload.key,
            coreName = platformPayload.coreName,
            styles = projected,
            totalVariationCount = projected.sumOf(ComponentStyleVariationsDto::variationCount),
        ),
    )
}

private fun ComponentBindingDto<ComponentBindingPayloadDto>.toFull(
    styles: List<ComponentStyleDto>,
    variationNames: Set<String>,
): ComponentBindingDto<ComponentBindingPayloadDto> = copyWithPayload(
    platformPayload.copy(
        styles = styles.map { style ->
            if (variationNames.isEmpty()) {
                style
            } else {
                style.copy(variations = style.variations.selectNamed(variationNames))
            }
        },
    ),
)

private fun List<ComponentVariationDto>.selectNamed(names: Set<String>): List<ComponentVariationDto> =
    if (names.isEmpty()) this else filter { it.name in names }

private fun <T> ComponentBindingDto<*>.copyWithPayload(payload: T): ComponentBindingDto<T> = ComponentBindingDto(
    id = id,
    subject = subject,
    kind = kind,
    name = name,
    platform = platform,
    platformPayload = payload,
)

private fun projectionJson(base: Json): Json = Json(base) {
    ignoreUnknownKeys = true
    encodeDefaults = false
    explicitNulls = false
}

@Suppress("ReturnCount")
internal fun parseVariationSelection(raw: String?): Map<String, String>? {
    if (raw == null) return emptyMap()
    val pairs = raw.split(',').map { part ->
        val delimiter = part.indexOf('=')
        if (delimiter <= 0 || delimiter == part.lastIndex) return null
        val id = part.substring(0, delimiter).trim()
        val value = part.substring(delimiter + 1).trim()
        if (id.isEmpty() || value.isEmpty()) return null
        id to value
    }
    if (pairs.map { it.first }.distinct().size != pairs.size) return null
    return pairs.toMap()
}
