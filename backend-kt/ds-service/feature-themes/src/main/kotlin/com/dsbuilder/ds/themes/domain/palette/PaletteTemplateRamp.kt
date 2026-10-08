package com.dsbuilder.ds.themes.domain.palette

/** Растяжка копии шаблона темы. */
data class PaletteTemplateRamp(
    /** Растяжка. */
    val ramp: PaletteRampRef,
    /** Ступени от светлой к тёмной: ступень → `#RRGGBB`. */
    val steps: List<Pair<Int, String>>,
)
