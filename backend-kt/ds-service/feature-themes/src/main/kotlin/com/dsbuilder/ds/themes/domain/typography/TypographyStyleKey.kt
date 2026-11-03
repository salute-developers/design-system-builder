package com.dsbuilder.ds.themes.domain.typography

/** Стиль без экрана: группа и размер, например `body.m`. */
data class TypographyStyleKey(
    /** Группа: системная `display`, `header`, `body`, `text` или своя группа дизайн-системы. */
    val group: String,
    /** Размер внутри группы: `m`, `h1`. */
    val size: String,
) : Comparable<TypographyStyleKey> {
    override fun toString(): String = "$group.$size"

    override fun compareTo(other: TypographyStyleKey): Int = ORDER.compare(this, other)

    companion object {
        /** Системные группы в порядке дерева; свои группы идут после них по имени. */
        val GROUPS = listOf("display", "header", "body", "text")
        private val SIZES = listOf("xxl", "xl", "l", "m", "s", "xs", "xxs")
        private val HEADER = Regex("""^h(\d+)$""")

        private val ORDER: Comparator<TypographyStyleKey> = compareBy<TypographyStyleKey>(
            { key -> GROUPS.indexOf(key.group).takeIf { it >= 0 } ?: GROUPS.size },
            { key -> key.group },
            { key -> sizeRank(key.size) },
            { key -> key.size },
        )

        /** Заголовки — по номеру, остальные размеры — от крупного к мелкому, неизвестные — в конце. */
        fun sizeRank(size: String): Int =
            HEADER.matchEntire(size)?.groupValues?.get(1)?.toInt()
                ?: SIZES.indexOf(size).takeIf { it >= 0 }
                ?: Int.MAX_VALUE
    }
}
