package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

/** Слой тени в px в формате чтения раздела. */
@Serializable
@OptIn(ExperimentalSerializationApi::class)
data class ShadowLayerDto(
    /** Смещение по X. */
    val offsetX: Int,
    /** Смещение по Y. */
    val offsetY: Int,
    /** Размытие. */
    val blur: Int,
    /** Растяжение. */
    val spread: Int,
    /** Раскрытый цвет `#RRGGBBAA`. */
    val color: String,
    /** Исходная ссылка на ступень палитры `[type.shade.step][opacity]`, если цвет слоя — ссылка; у HEX нет. */
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val colorRef: String? = null,
)
