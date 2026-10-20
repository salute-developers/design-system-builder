package com.dsbuilder.ds.themes.domain.typography

/** Подсчёт использования стилей в значениях свойств компонентов. */
object TypographyUsage {
    /** Стиль → компоненты по убыванию числа ссылок, при равенстве — по имени. */
    fun count(references: List<ComponentPropertyReference>): Map<TypographyStyleKey, List<TypographyComponentUsage>> =
        references
            .mapNotNull { item ->
                TypographyTokenName.reference(item.reference)?.let { (key, _) -> key to item.component }
            }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, components) ->
                components.groupingBy { it }
                    .eachCount()
                    .map { (name, count) -> TypographyComponentUsage(name, count) }
                    .sortedWith(compareByDescending<TypographyComponentUsage> { it.count }.thenBy { it.name })
            }
}
