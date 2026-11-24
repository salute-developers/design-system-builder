package com.dsbuilder.ds.components.domain

import java.util.UUID

/**
 * Разрешение имени состояния в пределах компонента — одно правило для всех путей: сначала общее состояние
 * (`componentId == null`), затем собственное состояние компонента. Состояния других компонентов не рассматриваются.
 * Собственное состояние с именем общего («тень») для новых записей не выбирается.
 */
object StateNames {
    /** Каноническая форма имени: регистр и разделители не различаются. */
    fun canonical(name: String): String = name.lowercase().filter(Char::isLetterOrDigit)

    /** Состояние, найденное по [name] среди [states] для компонента [componentId], или `null`. */
    fun <T> resolve(name: String, componentId: UUID?, states: Collection<T>, scope: (T) -> Scoped): T? {
        val key = canonical(name)
        val matching = states.filter { canonical(scope(it).name) == key }
        return matching.firstOrNull { scope(it).componentId == null }
            ?: componentId?.let { owner -> matching.firstOrNull { scope(it).componentId == owner } }
    }

    /** Состояния, которые видит компонент: общие и собственные без «теней», в исходном порядке. */
    fun <T> visible(componentId: UUID?, states: Collection<T>, scope: (T) -> Scoped): List<T> {
        val common = states.filter { scope(it).componentId == null }
        val commonNames = common.mapTo(HashSet()) { canonical(scope(it).name) }
        return states.filter {
            val state = scope(it)
            state.componentId == null ||
                (state.componentId == componentId && canonical(state.name) !in commonNames)
        }
    }

    /** Принадлежность и имя состояния. */
    data class Scoped(
        /** Компонент-владелец; `null` у общего состояния. */
        val componentId: UUID?,
        /** Имя состояния. */
        val name: String,
    )
}
