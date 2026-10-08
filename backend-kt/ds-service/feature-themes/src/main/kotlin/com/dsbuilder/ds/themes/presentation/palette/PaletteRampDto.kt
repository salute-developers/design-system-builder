package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Растяжка в группе палитры. */
@Serializable
data class PaletteRampDto(
    /** Слот, на который ссылаются токены. */
    val slot: PaletteRampRefDto,
    /** Источник значений. */
    val source: PaletteRampRefDto,
    /** Отображаемое имя. */
    val displayName: String,
    /** `template` или `rebuild`. */
    val origin: String,
    /** Опорный цвет перестройки. */
    val anchor: PaletteAnchorDto?,
    /** Добавлена ли растяжка в группу явно. */
    val added: Boolean,
    /** Есть ли правки ступеней. */
    val modified: Boolean,
    /** Число связей растяжки. */
    val linkedCount: Int,
    /** Ступени. */
    val steps: List<PaletteStepDto>,
)
