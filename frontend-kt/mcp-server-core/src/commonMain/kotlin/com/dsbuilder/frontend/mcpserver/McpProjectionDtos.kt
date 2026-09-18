package com.dsbuilder.frontend.mcpserver

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

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
    val platformPayload: JsonElement,
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
