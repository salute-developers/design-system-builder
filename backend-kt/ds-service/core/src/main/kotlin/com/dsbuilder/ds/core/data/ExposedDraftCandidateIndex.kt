package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DraftChangeCandidateIndex
import com.dsbuilder.ds.core.application.DraftChangeHandler
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.IColumnType
import org.jetbrains.exposed.v1.core.LongColumnType
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Одним запросом определяет типы, для которых требуется подробное предметное сравнение. */
class ExposedDraftCandidateIndex(
    private val entityType: String,
    private val revision: Table,
    private val sequence: Column<Long>,
) : DraftChangeCandidateIndex {
    override fun populatedTypes(
        designSystemId: UUID,
        sequenceNumber: Long,
        previousSequenceNumber: Long,
        handlers: List<DraftChangeHandler>,
    ): Set<String> {
        val transaction = TransactionManager.current()
        val indexed = handlers.mapNotNull { it.candidateIndex as? ExposedDraftCandidateIndex }
        val fallback = handlers.filter { it.candidateIndex !is ExposedDraftCandidateIndex }.map { it.entityType }
        if (indexed.isEmpty()) return fallback.toSet()
        val args = mutableListOf<Pair<IColumnType<*>, Any?>>()
        val sql = indexed.joinToString(" UNION ALL ") { source ->
            args += TextColumnType() to source.entityType
            args += UUIDColumnType() to designSystemId
            args += LongColumnType() to previousSequenceNumber
            args += LongColumnType() to sequenceNumber
            "SELECT CAST(? AS text) AS entity_type WHERE EXISTS (SELECT 1 FROM " +
                "${transaction.identity(source.revision)} WHERE design_system_id=? " +
                "AND ${transaction.identity(source.sequence)}>? AND ${transaction.identity(source.sequence)}<=?)"
        }
        val populated = transaction.exec(sql, args) { rows ->
            buildSet { while (rows.next()) add(rows.getString(1)) }
        }.orEmpty()
        return populated + fallback
    }
}

/** Сохраняет неизвестные обработчики и отбирает известные типы по общему индексу. */
fun populatedDraftHandlers(
    handlers: List<DraftChangeHandler>,
    owner: UUID,
    sequence: Long,
    previous: Long,
): List<DraftChangeHandler> {
    val index = handlers.firstNotNullOfOrNull { it.candidateIndex } ?: return handlers
    val types = index.populatedTypes(owner, sequence, previous, handlers)
    return handlers.filter { it.entityType in types }
}
