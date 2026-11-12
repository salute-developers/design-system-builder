package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.Key
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.statements.jdbc.JdbcResult
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/**
 * Ограниченное чтение последней предметной ревизии. Граница выбирается до поиска ревизий, а предметный фильтр
 * применяется после него: удалённая или сменившая тип сущность не подменяется прежней редакцией.
 */
class ResolvedSubjectRows(
    private val stable: Table,
    private val revision: Table,
    private val boundary: Table,
    private val revisionEntity: Column<UUID>,
    private val owner: Table? = null,
    private val designSystemId: UUID? = null,
) {
    /** Читает строки на разрешённых границах текущей транзакции без изменения предметных данных. */
    fun read(predicate: Op<Boolean>): List<ResultRow> {
        val selection = selection(predicate) ?: return emptyList()
        val transaction = TransactionManager.current()
        val cache = if (transaction.connection.readOnly) transaction.getOrCreate(READS) { mutableMapOf() } else null
        cache?.get(selection.key)?.let { return it }
        val rows = transaction.exec(
            selection.builder.toString(),
            selection.builder.args,
            explicitStatementType = StatementType.SELECT,
        ) { result ->
            val indices: Map<Expression<*>, Int> = selection.fields.withIndex().associate { it.value to it.index }
            buildList {
                while (result.next()) add(ResultRow.create(JdbcResult(result), indices))
            }
        }.orEmpty()
        cache?.put(selection.key, rows)
        return rows
    }

    /** Возвращает уже прочитанный точный набор только в readOnly-контексте, не загружая строки при промахе. */
    fun cached(predicate: Op<Boolean>): List<ResultRow>? {
        val transaction = TransactionManager.current()
        if (!transaction.connection.readOnly) return null
        val cache = transaction.getUserData(READS) ?: return null
        return selection(predicate)?.let { cache[it.key] }
    }

    private fun selection(predicate: Op<Boolean>): RowSelection? {
        val transaction = TransactionManager.current()
        val tables = listOf(stable, revision, boundary) + listOfNotNull(owner)
        val fields = tables.flatMap(Table::columns)
        val builder = QueryBuilder(true)
        val stableName = transaction.identity(stable)
        val revisionName = transaction.identity(revision)
        val boundaryName = transaction.identity(boundary)
        val entityName = transaction.identity(revisionEntity).substringAfterLast('.')
        val ownerJoin = owner?.let {
            "JOIN ${transaction.identity(it)} ON ${transaction.identity(it)}.id = $stableName.design_system_id"
        }.orEmpty()
        builder.append("WITH selected_boundaries AS MATERIALIZED (SELECT * FROM design_system_versions boundary WHERE ")
        if (!appendBoundaries(builder)) return null
        builder.append(") SELECT ")
        fields.forEachIndexed { index, column ->
            if (index > 0) builder.append(", ")
            builder.append(transaction.identity(column.table))
            builder.append(".")
            builder.append(transaction.identity(column))
        }
        builder.append(
            " FROM $stableName JOIN selected_boundaries AS $boundaryName " +
                "ON $boundaryName.design_system_id = $stableName.design_system_id " +
                "JOIN LATERAL (SELECT * FROM $revisionName candidate " +
                "WHERE candidate.$entityName = $stableName.id " +
                "AND candidate.version_sequence_number <= $boundaryName.sequence_number " +
                "ORDER BY candidate.version_sequence_number DESC LIMIT 1) AS $revisionName ON true " +
                "$ownerJoin WHERE ",
        )
        builder.append(predicate)
        return RowSelection(fields, builder)
    }
    private fun appendBoundaries(builder: QueryBuilder): Boolean {
        if (TransactionManager.current().connection.readOnly) {
            val ids = selectedBoundaryIds(designSystemId)
            if (ids.isEmpty()) return false
            builder.append("boundary.id IN (")
            ids.forEachIndexed { index, id ->
                if (index > 0) builder.append(",")
                builder.registerArgument(UUIDColumnType(), id)
            }
            builder.append(")")
        } else {
            builder.append(selectedVersionBoundary("boundary"))
            designSystemId?.let {
                builder.append(" AND boundary.design_system_id = ")
                builder.registerArgument(UUIDColumnType(), it)
            }
        }
        return true
    }
}

private class RowSelection(val fields: List<Column<*>>, val builder: QueryBuilder) {
    val key = ReadKey(fields, builder.toString(), builder.args.map { it.second })
}

private data class ReadKey(val fields: List<Column<*>>, val sql: String, val arguments: List<Any?>)
private val READS = Key<MutableMap<ReadKey, List<ResultRow>>>()
private val BOUNDARIES = Key<MutableMap<UUID?, List<UUID>>>()

private fun selectedBoundaryIds(designSystemId: UUID?): List<UUID> {
    val transaction = TransactionManager.current()
    val cache = transaction.getOrCreate(BOUNDARIES) { mutableMapOf() }
    cache[designSystemId]?.let { return it }
    val builder = QueryBuilder(true)
    builder.append("SELECT id FROM design_system_versions WHERE ")
    builder.append(selectedVersionBoundary("design_system_versions"))
    designSystemId?.let {
        builder.append(" AND design_system_id = ")
        builder.registerArgument(UUIDColumnType(), it)
    }
    val ids = transaction.exec(builder.toString(), builder.args) { rows ->
        buildList { while (rows.next()) add(rows.getObject(1, UUID::class.java)) }
    }.orEmpty()
    cache[designSystemId] = ids
    return ids
}

/** Сбрасывает результаты перед установкой другого доверенного контекста той же транзакции. */
fun clearResolvedSubjectReads() {
    TransactionManager.current().removeUserData(READS)
    TransactionManager.current().removeUserData(BOUNDARIES)
}
