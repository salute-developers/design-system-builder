package com.dsbuilder.ds.themes.application.colortokens

import java.util.UUID

/** Добавление состояния существующему цветовому токену со значениями каждой темы дизайн-системы. */
data class AddColorTokenState(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Состояние: `hover`, `active` или `brightness`. */
    val state: String,
    /** Значения членов состояния по темам: тема → полное имя члена → значения. */
    val tenants: Map<UUID, Map<String, List<ColorTokenValue>>>,
)
