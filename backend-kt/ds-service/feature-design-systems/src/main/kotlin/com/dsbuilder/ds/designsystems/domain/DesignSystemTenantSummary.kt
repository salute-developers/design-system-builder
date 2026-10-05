package com.dsbuilder.ds.designsystems.domain

import java.time.Instant
import java.util.UUID

/** Tenant fields exposed by the design-system aggregate endpoint. */
data class DesignSystemTenantSummary(
    /** Id carried by this contract. */
    val id: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Name carried by this contract. */
    val name: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Color configuration carried by this contract. */
    val colorConfiguration: ColorConfiguration,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
) {
    /** Tenant color configuration independent from transport and persistence libraries. */
    data class ColorConfiguration(
        /** Gray tone carried by this contract. */
        val grayTone: String?,
        /** Accent color carried by this contract. */
        val accentColor: String?,
        /** Light carried by this contract. */
        val light: Saturation?,
        /** Dark carried by this contract. */
        val dark: Saturation?,
    ) {
        /** Light or dark saturation pair. */
        data class Saturation(
            /** Stroke saturation carried by this contract. */
            val strokeSaturation: Double,
            /** Fill saturation carried by this contract. */
            val fillSaturation: Double,
        )
    }
}
