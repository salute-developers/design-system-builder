package com.dsbuilder.ds.core.application

/** Область данных редактора, которую требуется перечитать после подтверждённого изменения. */
enum class DraftInvalidationScope(
    /** Значение области в транспортном контракте. */
    val wireName: String,
) {
    THEME_TOKENS("theme-tokens"),
    THEME_METADATA("theme-metadata"),
    COMPONENT_CONFIGURATIONS("component-configurations"),
    DESIGN_SYSTEM("design-system"),
    ALL("all"),
    ;

    companion object {
        /** Преобразует значение транспортного контракта в предметную область. */
        fun fromWire(value: String): DraftInvalidationScope? = entries.firstOrNull { it.wireName == value }
    }
}
