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
    /** Текущая техническая ревизия значения. */
    val editRevision: Long,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
    /** Исходная ссылка на палитру, если `value` вычислен по палитре темы. */
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val paletteRef: String? = null,
    /** Своё значение iOS или Android, а не построенное клиентом из web. */
    @EncodeDefault(EncodeDefault.Mode.ALWAYS)
    val overridden: Boolean = false,
    /** Хранимое значение, если `value` отдан в другой форме: со ссылками, раскрытыми в HEX, или слоем `color`. */
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val sourceValue: JsonElement? = null,
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
            value.editRevision,
            value.createdAt.toString(),
            value.updatedAt.toString(),
            value.paletteRef,
            value.overridden,
            value.sourceValueJson?.let(Json::parseToJsonElement),
        )
    }
}
