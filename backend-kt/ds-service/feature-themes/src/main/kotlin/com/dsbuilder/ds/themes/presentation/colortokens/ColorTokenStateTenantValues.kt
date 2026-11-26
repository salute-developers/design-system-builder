package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Значения членов состояния в одной теме. */
@Serializable
data class ColorTokenStateTenantValues(
    /** Тема дизайн-системы. */
    val tenantId: String,
    /** Члены состояния `<group>.<subgroup>.<name>-<state>` со значениями. */
    val members: List<ColorTokenMemberValues>,
)
