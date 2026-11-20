package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Тело `POST /tenants/{tenantId}/color-tokens/{tokenId}/states`. */
@Serializable
data class AddColorTokenStateRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Состояние: `hover`, `active` или `brightness`. */
    val state: String,
    /** Значения членов состояния для каждой темы дизайн-системы. */
    val tenants: List<ColorTokenStateTenantValues>,
)

/** Значения членов состояния в одной теме. */
@Serializable
data class ColorTokenStateTenantValues(
    /** Тема дизайн-системы. */
    val tenantId: String,
    /** Члены состояния `<group>.<subgroup>.<name>-<state>` со значениями. */
    val members: List<ColorTokenMemberValues>,
)
