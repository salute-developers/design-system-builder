package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Тело привязки токена к группе; `groupId = null` сбрасывает привязку. */
@Serializable
data class PaletteTokenGroupRequest(
    /** Группа. */
    val groupId: String?,
    /** Ревизия темы. */
    val editRevision: Int,
)
