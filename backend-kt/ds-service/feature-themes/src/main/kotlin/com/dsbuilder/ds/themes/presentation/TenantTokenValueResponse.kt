package com.dsbuilder.ds.themes.presentation

import com.dsbuilder.ds.themes.domain.TenantTokenValue
import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/** External token value returned by the nested tenant lookup. */
@Serializable
@OptIn(ExperimentalSerializationApi::class)
data class TenantTokenValueResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Token id carried by this contract. */
    val tokenId: String?,
    /** Tenant id carried by this contract. */
    val tenantId: String?,
    /** Palette id carried by this contract. */
    val paletteId: String?,
    /** Platform carried by this contract. */
    val platform: String?,
    /** Mode carried by this contract. */
    val mode: String?,
    /** Value carried by this contract. */
    val value: JsonElement?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
    /** Исходная ссылка на палитру при `resolvePalette=true`, если `value` вычислен по палитре темы. */
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val paletteRef: String? = null,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: TenantTokenValue) = TenantTokenValueResponse(
            value.id.toString(),
            value.tokenId?.toString(),
            value.tenantId?.toString(),
            value.paletteId?.toString(),
            value.platform,
            value.mode,
            value.valueJson?.let(Json::parseToJsonElement),
            value.createdAt.toString(),
            value.updatedAt.toString(),
            value.paletteRef,
        )
    }
}
