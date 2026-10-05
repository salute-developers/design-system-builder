package com.dsbuilder.ds.themes.presentation

import kotlinx.serialization.Serializable

/** Ответ успешного пакетного сохранения значений темы. */
@Serializable
data class TenantTokenValuesSaveResponse(
    /** Новая ревизия темы. */
    val editRevision: Int,
)
