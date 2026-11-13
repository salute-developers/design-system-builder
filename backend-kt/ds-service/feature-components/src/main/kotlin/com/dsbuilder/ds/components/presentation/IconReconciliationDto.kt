package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Отчёт сверки. */
@Serializable
data class IconReconciliationDto(
    /** Разрешаемых значений. */
    val resolved: Int,
    /** Неразрешаемых значений. */
    val unresolved: Int,
    /** Неразрешаемые значения, не более 50. */
    val unresolvedValues: List<String>,
)
