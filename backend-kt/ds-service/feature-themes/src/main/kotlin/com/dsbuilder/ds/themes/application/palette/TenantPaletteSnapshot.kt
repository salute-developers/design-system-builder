package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.themes.domain.palette.PaletteTokenRef
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenValue
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState

/** Состояние палитры темы с цветовыми токенами дизайн-системы и их значениями в теме. */
data class TenantPaletteSnapshot(
    /** Состояние палитры. */
    val state: TenantPaletteState,
    /** Цветовые токены дизайн-системы темы. */
    val tokens: List<PaletteTokenRef>,
    /** Цветовые значения токенов темы с разобранными ссылками. */
    val values: List<PaletteTokenValue>,
    /** Принадлежит ли дизайн-система темы проекту; общую дизайн-систему (`project_id IS NULL`) проект только читает. */
    val owned: Boolean = true,
)
