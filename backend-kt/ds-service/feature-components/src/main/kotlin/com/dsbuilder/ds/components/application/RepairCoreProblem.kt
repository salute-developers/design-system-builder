package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.EditorValueKind
import java.util.UUID

/** Явный адрес источника; отсутствие targetPropertyId означает удаление. */
data class RepairCoreProblem(
    /** ID оформления; отсутствует у проблемы компонента целиком. */
    val appearanceId: UUID,
    /** Область назначения: invariant, variation или combination. */
    val valueKind: EditorValueKind,
    /** ID сохранённого назначения для исправления. */
    val valueId: UUID,
    /** Ожидаемая предметная ревизия исходного назначения. */
    val expectedRevision: Long,
    /** Явно выбранное свойство для переноса; null означает удаление. */
    val targetPropertyId: UUID? = null,
)
