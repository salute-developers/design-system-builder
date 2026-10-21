package com.dsbuilder.ds.themes.domain.typography

/** Стили типографии темы для раздела «Типографика». */
data class TypographyStyles(
    /** Может ли пользователь менять стили: право записи и активный черновик. */
    val canEdit: Boolean,
    /** Число тем дизайн-системы. */
    val themeCount: Int,
    /** Семейства шрифтов дизайн-системы. */
    val families: List<TypographyFamily>,
    /** Стили по экранам от крупного к мелкому. */
    val screens: List<TypographyScreenView>,
)
