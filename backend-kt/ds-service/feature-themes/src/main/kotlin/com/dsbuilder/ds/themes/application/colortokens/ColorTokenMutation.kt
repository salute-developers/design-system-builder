package com.dsbuilder.ds.themes.application.colortokens

/** Итог операции над цветовым токеном: новая ревизия текущей темы и значение операции. */
data class ColorTokenMutation<T>(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Значение операции. */
    val value: T,
    /** Подтверждённые значения семейства из той же транзакции; null для прежних адаптеров. */
    val structure: ColorTokenStructure? = null,
    /** Полные подтверждённые значения текущей темы. */
    val confirmedValues: List<com.dsbuilder.ds.themes.domain.TenantTokenValue>? = null,
)
