package com.dsbuilder.ds.core.application

import kotlinx.serialization.json.JsonObject

/** Отображаемое предметное состояние, подготовленное владельцем сущности. */
data class DraftChangeSnapshot(
    /** Признак удаления на выбранной временной границе. */
    val deleted: Boolean,
    /** Разрешённые предметным модулем поля для отображения и сравнения. */
    val value: JsonObject,
)
