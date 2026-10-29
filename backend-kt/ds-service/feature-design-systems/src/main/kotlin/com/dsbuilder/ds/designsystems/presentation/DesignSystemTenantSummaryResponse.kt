package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemTenantSummary
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Legacy-compatible tenant aggregate response. */
@Serializable
data class DesignSystemTenantSummaryResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Name carried by this contract. */
    val name: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Color config carried by this contract. */
    val colorConfig: JsonObject,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: DesignSystemTenantSummary) = DesignSystemTenantSummaryResponse(
            value.id.toString(),
            value.designSystemId.toString(),
            value.name,
            value.description,
            value.colorConfiguration.toResponse(),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}

private fun DesignSystemTenantSummary.ColorConfiguration.toResponse() = buildJsonObject {
    grayTone?.let { put("grayTone", it) }
    accentColor?.let { put("accentColor", it) }
    light?.let { saturation ->
        put(
            "light",
            buildJsonObject {
                put("strokeSaturation", saturation.strokeSaturation)
                put("fillSaturation", saturation.fillSaturation)
            },
        )
    }
    dark?.let { saturation ->
        put(
            "dark",
            buildJsonObject {
                put("strokeSaturation", saturation.strokeSaturation)
                put("fillSaturation", saturation.fillSaturation)
            },
        )
    }
}
