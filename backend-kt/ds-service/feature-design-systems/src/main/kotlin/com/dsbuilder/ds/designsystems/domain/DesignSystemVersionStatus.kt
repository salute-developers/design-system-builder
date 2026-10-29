package com.dsbuilder.ds.designsystems.domain

/** Состояние временной границы дизайн-системы. */
enum class DesignSystemVersionStatus(/** Значение, сохраняемое в БД и передаваемое по API. */ val wireValue: String) {
    BASELINE("baseline"),
    DRAFT("draft"),
    PUBLISHED("published"),
    ;

    companion object {
        /** Возвращает состояние по его внешнему представлению. */
        fun fromWire(value: String): DesignSystemVersionStatus? = entries.firstOrNull { it.wireValue == value }
    }
}
