package com.dsbuilder.ds.components.domain

/** Значение иконки старого формата `<ключ>.<размер>`. */
object LegacyIconValue {
    /** Разбирает значение; без числового размера из набора `16/24/36` возвращает `null`. */
    fun parse(value: String): Pair<String, IconSize>? {
        val dot = value.lastIndexOf('.')
        if (dot <= 0) return null
        val size = value.substring(dot + 1).toIntOrNull()?.let(IconSize::fromPx) ?: return null
        return value.substring(0, dot) to size
    }

    /**
     * Ключи каталога, в которые разрешается ключ значения: сам ключ и он же с начертанием `Outline` (значения вроде
     * `close.24` записаны без начертания и означают `CloseOutline`). Точное совпадение имеет приоритет.
     */
    fun candidates(key: String): List<String> = listOf(key, "$key.outline")

    /** Значение старого формата для [legacyKey] и [size]. */
    fun format(legacyKey: String, size: IconSize): String = "$legacyKey.${size.px}"
}
