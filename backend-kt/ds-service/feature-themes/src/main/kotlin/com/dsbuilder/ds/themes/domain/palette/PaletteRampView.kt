package com.dsbuilder.ds.themes.domain.palette

/** Растяжка группы с вычисленными значениями. */
data class PaletteRampView(
    /** Слот. */
    val slot: PaletteRampRef,
    /** Источник. */
    val source: PaletteRampRef,
    /** Отображаемое имя. */
    val displayName: String,
    /** Происхождение значений. */
    val origin: PaletteRampOrigin,
    /** Опорная ступень перестройки. */
    val anchor: PaletteAnchor?,
    /** Растяжка добавлена явно. */
    val added: Boolean,
    /** У растяжки есть правки ступеней. */
    val modified: Boolean,
    /** Число пар «токен — режим», ссылающихся на растяжку. */
    val linkedCount: Int,
    /** Ступени от светлой к тёмной. */
    val steps: List<PaletteStepView>,
)
