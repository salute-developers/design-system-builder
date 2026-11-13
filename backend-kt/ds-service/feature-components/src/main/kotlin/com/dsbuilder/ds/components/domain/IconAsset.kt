package com.dsbuilder.ds.components.domain

/** SVG одного размера одной иконки. */
data class IconAsset(
    /** Каноническое имя. */
    val name: String,
    /** Размер. */
    val size: IconSize,
    /** Содержимое SVG. */
    val svg: String,
) {
    /** Контрольная сумма SVG (hex SHA-256). */
    val sha256: String = IconHashing.sha256(svg.toByteArray(Charsets.UTF_8))
}
