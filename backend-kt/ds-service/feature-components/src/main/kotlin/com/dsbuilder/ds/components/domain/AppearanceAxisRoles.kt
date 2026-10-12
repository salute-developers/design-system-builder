package com.dsbuilder.ds.components.domain

/** Имя оси, которую выбирает правило фолбэка, когда корень не указан. */
const val FALLBACK_ROOT_AXIS_NAME = "size"

/**
 * Ось-кандидат на роль корня.
 *
 * @property key идентификатор оси в том виде, в каком его знает вызывающий код.
 * @property name имя оси.
 * @property position позиция оси у appearance.
 */
data class RootCandidate<K>(val key: K, val name: String, val position: Int)

/**
 * Выбирает корневую ось, когда она не указана явно.
 *
 * Среди осей, кроме оси цветовой схемы и [excluded], берётся ось с именем [FALLBACK_ROOT_AXIS_NAME],
 * иначе первая по позиции. Если подходящих осей нет, корня нет.
 */
fun <K> fallbackRoot(candidates: List<RootCandidate<K>>, colorScheme: K?, excluded: K? = null): K? {
    val pool = candidates.filter { it.key != colorScheme && it.key != excluded }.sortedBy { it.position }
    return (pool.firstOrNull { it.name == FALLBACK_ROOT_AXIS_NAME } ?: pool.firstOrNull())?.key
}
