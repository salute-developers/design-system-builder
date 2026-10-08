package com.dsbuilder.ds.themes.domain

import java.time.Instant
import java.util.UUID

/** Token-value read model local to the themes feature. */
data class TenantTokenValue(
    /** Id carried by this contract. */
    val id: UUID,
    /** Token id carried by this contract. */
    val tokenId: UUID?,
    /** Tenant id carried by this contract. */
    val tenantId: UUID?,
    /** Palette id carried by this contract. */
    val paletteId: UUID?,
    /** Platform carried by this contract. */
    val platform: String?,
    /** Mode carried by this contract. */
    val mode: String?,
    /** Value json carried by this contract. */
    val valueJson: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
    /** Исходная ссылка на палитру, если [valueJson] вычислен по палитре темы. */
    val paletteRef: String? = null,
)
