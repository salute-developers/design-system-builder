package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.domain.TenantTokenValueInput

/** Проверенная команда пакетного сохранения значений темы. */
data class SaveTenantTokenValues(
    /** Ожидаемая ревизия темы. */
    val expectedEditRevision: Int,
    /** Полный набор platform-specific значений. */
    val values: List<TenantTokenValueInput>,
)
