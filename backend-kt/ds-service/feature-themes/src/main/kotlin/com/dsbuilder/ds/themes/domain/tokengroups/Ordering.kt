package com.dsbuilder.ds.themes.domain.tokengroups

/** Порядок элементов среди соседей: позиции всегда подряд с нуля. */
object Ordering {
    /** [order] без [item] и с ним на позиции [position]; `null` или позиция за концом — в конец. */
    fun <T> place(order: List<T>, item: T, position: Int?): List<T> {
        val rest = order.filter { it != item }
        val index = position?.coerceIn(0, rest.size) ?: rest.size
        return rest.take(index) + item + rest.drop(index)
    }
}
