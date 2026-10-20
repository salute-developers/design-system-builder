package com.dsbuilder.ds.themes.domain.typography

/** Стиль без экрана: группа и размер, например `body.m`. */
data class TypographyStyleKey(
    /** Группа: `display`, `header`, `body`, `text`. */
    val group: String,
    /** Размер внутри группы: `m`, `h1`. */
    val size: String,
) : Comparable<TypographyStyleKey> {
    override fun toString(): String = "$group.$size"

    override fun compareTo(other: TypographyStyleKey): Int = ORDER.compare(this, other)

    private companion object {
        val GROUPS = listOf("display", "header", "body", "text")
        val SIZES = listOf("xxl", "xl", "l", "m", "s", "xs", "xxs")
        val HEADER = Regex("""^h(\d+)$""")

        val ORDER: Comparator<TypographyStyleKey> = compareBy<TypographyStyleKey>(
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
