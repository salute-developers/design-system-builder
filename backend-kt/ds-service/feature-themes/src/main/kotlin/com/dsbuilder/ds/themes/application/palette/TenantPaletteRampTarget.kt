package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef

/** Растяжка в группе палитры: адрес операций над растяжкой. */
data class TenantPaletteRampTarget(
    /** Группа. */
    val groupId: String,
    /** Слот растяжки. */
    val slot: PaletteRampRef,
)
