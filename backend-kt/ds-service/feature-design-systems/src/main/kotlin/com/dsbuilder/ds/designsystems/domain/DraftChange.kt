package com.dsbuilder.ds.designsystems.domain

import kotlinx.serialization.json.JsonObject
import java.time.Instant
import java.util.UUID

/** Вычисленное отличие выбранной границы от предыдущей опубликованной границы. */
data class DraftChange(
    /** Устойчивый идентификатор отличия внутри версии. */
    val changeId: UUID,
    /** Сравниваемая временная граница. */
    val versionId: DesignSystemVersionId,
    /** Дизайн-система изменения. */
    val designSystemId: DesignSystemId,
    /** Тип устойчивой предметной сущности. */
    val entityType: String,
    /** Идентификатор устойчивой предметной сущности. */
    val entityId: UUID,
    /** Вид отличия от предыдущей публикации. */
    val operation: ChangeOperation,
    /** Изменённые предметные пути. */
    val changedPaths: Set<String>,
    /** Отображаемое предыдущее значение. */
    val previousValue: JsonObject?,
    /** Отображаемое новое значение. */
    val currentValue: JsonObject?,
    /** Автор последнего изменения, если он известен. */
    val actorId: String?,
    /** Время последнего изменения. */
    val changedAt: Instant,
    /** Текущая техническая редакция сущности. */
    val editRevision: Long,
)
