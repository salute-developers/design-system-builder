package com.dsbuilder.ds.core.application

import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** Предметное отличие двух временных границ. */
data class DraftSubjectChange(
    /** Идентификатор устойчивой предметной сущности. */
    val entityId: UUID,
    /** Значение на предыдущей опубликованной границе. */
    val previousValue: JsonObject?,
    /** Значение на выбранной границе. */
    val currentValue: JsonObject?,
    /** Точные предметные пути изменившихся полей. */
    val changedPaths: Set<String>,
    /** Непрозрачная редакция составного изменения, учитывающая его дочерние значения. */
    val comparisonRevision: Long? = null,
)
