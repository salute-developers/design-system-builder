package com.dsbuilder.ds.themes.domain.palette

/** Хранимая растяжка группы: появляется, когда растяжку добавили или изменили. */
data class StoredPaletteRamp(
    /** Группа растяжки. */
    val groupId: String,
    /** Слот: на него ссылаются токены группы. */
    val slot: PaletteRampRef,
    /** Источник значений в копии шаблона темы. */
    val source: PaletteRampRef,
    /** Растяжка добавлена в группу явно. */
    val added: Boolean,
    /** Происхождение значений. */
    val origin: PaletteRampOrigin,
    /** Опорная ступень перестройки. */
    val anchor: PaletteAnchor?,
    /** Правки ступеней: ступень → `#RRGGBB`. */
    val steps: Map<Int, String>,
)
