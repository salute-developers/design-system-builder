package com.dsbuilder.ds.components.domain

import java.util.UUID

/** Правило допустимого набора состояний значения свойства. */
object StateSetRule {
    /** Итог проверки набора. */
    enum class Verdict {
        /** Набор допустим. */
        ALLOWED,

        /** В наборе состояние другого компонента. */
        FOREIGN_STATE,

        /** Набор не поддерживается признаком свойства. */
        NOT_SUPPORTED,
    }

    /**
     * Проверяет [set] для свойства компонента [componentId].
     *
     * [supported] — состояния из списка свойства или `null`, если признак не задан. Имена сравниваются в
     * канонической форме: значение, записанное в «тень» общего состояния, равно значению в общем состоянии.
     */
    fun check(
        componentId: UUID?,
        supported: List<StateNames.Scoped>?,
        combinations: Boolean,
        set: List<StateNames.Scoped>,
    ): Verdict {
        if (set.any { it.componentId != null && it.componentId != componentId }) return Verdict.FOREIGN_STATE
        val names = set.mapTo(HashSet()) { StateNames.canonical(it.name) }
        val allowed = supported?.mapTo(HashSet()) { StateNames.canonical(it.name) }
        val fits = allowed == null || allowed.containsAll(names) && (combinations || names.size < 2)
        return if (fits) Verdict.ALLOWED else Verdict.NOT_SUPPORTED
    }
}
