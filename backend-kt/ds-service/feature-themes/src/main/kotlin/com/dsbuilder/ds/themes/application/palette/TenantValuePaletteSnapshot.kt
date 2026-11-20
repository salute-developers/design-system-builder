package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.themes.domain.palette.PaletteTokenRef
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenValue
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState

/** Данные только для раскрытия выбранных значений; не содержат полного набора связей палитры. */
data class TenantValuePaletteSnapshot(
    /** Состояние групп, шаблона и растяжек. */
    val state: TenantPaletteState,
    /** Цветовые определения выбранного набора. */
    val tokens: List<PaletteTokenRef>,
    /** Ссылки выбранных значений на записи палитры. */
    val values: List<PaletteTokenValue>,
    /** Определения теней для разрешения имён групп. */
    val layerTokens: List<PaletteTokenRef> = emptyList(),
)
