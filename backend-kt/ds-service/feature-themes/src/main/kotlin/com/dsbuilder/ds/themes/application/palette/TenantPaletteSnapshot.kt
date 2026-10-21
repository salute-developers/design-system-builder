package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.themes.domain.palette.PaletteTokenRef
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenValue
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState
import com.dsbuilder.ds.themes.domain.palette.ThemePalette
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder

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
    /** Предметные редакции групп, растяжек, ступеней и привязок для адресной записи клиента. */
    val subjectRevisions: Map<String, Long> = emptyMap(),
    /** Токены теней дизайн-системы: их слои ссылаются на ступени палитры, но в группы палитры они не входят. */
    val layerTokens: List<PaletteTokenRef> = emptyList(),
    /** Ссылки цветов слоёв теней темы на ступени палитры: по одной на слой со ссылкой. */
    val layerValues: List<PaletteTokenValue> = emptyList(),
) {
    /** Палитра темы со связями цветовых токенов и слоёв теней. */
    fun palette(tenantId: String, canEdit: Boolean): ThemePalette =
        ThemePaletteBuilder.build(tenantId, canEdit, state, tokens, values, layerTokens, layerValues)
}
