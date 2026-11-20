package com.dsbuilder.ds.components.data

import java.util.UUID

/**
 * Разбор хвоста ссылки `component_style` на группы сегментов (`resolve-component-style-reference-segments`).
 *
 * Группа подряд идущих сегментов равна либо имени значения вариации цели (один сегмент), либо исходному идентификатору
 * (`authored_id`) значения или сочетания целевого оформления (один или несколько сегментов через точку). Хвост
 * разрешён, если группы покрывают его целиком; стили групп идут в порядке сегментов. Самая длинная группа
 * пробуется первой, при равной длине имя значения раньше идентификатора.
 */
internal object ReferenceSegments {
    /**
     * Стили, на которые указывает [tail], или `null`, если ни одно разбиение не покрывает хвост.
     * [byName] разрешает один сегмент по имени, [authored] — группу по точному `authored_id`.
     */
    fun resolve(tail: List<String>, byName: (String) -> UUID?, authored: Map<String, List<UUID>>): List<UUID>? {
        val failed = BooleanArray(tail.size + 1)

        fun from(start: Int): List<UUID>? = when {
            start == tail.size -> emptyList()
            failed[start] -> null
            else -> (tail.size downTo start + 1).firstNotNullOfOrNull { end ->
                groupStyles(tail.subList(start, end), byName, authored)?.let { styles ->
                    from(end)?.let { styles + it }
                }
            }.also { if (it == null) failed[start] = true }
        }
        return from(0)
    }

    private fun groupStyles(
        group: List<String>,
        byName: (String) -> UUID?,
        authored: Map<String, List<UUID>>,
    ): List<UUID>? = (if (group.size == 1) byName(group.single())?.let(::listOf) else null)
        ?: authored[group.joinToString(".")]
}
