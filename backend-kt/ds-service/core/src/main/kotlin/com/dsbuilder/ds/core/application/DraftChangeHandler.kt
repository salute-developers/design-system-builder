package com.dsbuilder.ds.core.application

import java.util.UUID

/** Предметный обработчик одного типа версионируемой сущности. */
interface DraftChangeHandler {
    /** Устойчивое имя типа в журнале и технических редакциях. */
    val entityType: String

    /** Описывает отличия выбранной границы от предыдущей опубликованной. */
    fun describe(designSystemId: UUID, sequenceNumber: Long, previousSequenceNumber: Long): List<DraftSubjectChange>

    /** Проверяет наличие хотя бы одного предметного отличия без построения публичного журнала. */
    fun hasChanges(designSystemId: UUID, sequenceNumber: Long, previousSequenceNumber: Long): Boolean =
        describe(designSystemId, sequenceNumber, previousSequenceNumber).isNotEmpty()

    /** Удаляет черновую редакцию и, для созданной сущности, её устойчивую строку. */
    fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean
}
