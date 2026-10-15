package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftChangeSnapshot
import com.dsbuilder.ds.core.application.DraftSubjectChange
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.LongColumnType
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/**
 * Основа предметного обработчика на Exposed.
 *
 * Владелец предметных таблиц передаёт реальные столбцы, которые разрешено показывать в журнале. Поэтому общая точка
 * журнала не читает строку целиком и не может записать произвольный JSON обратно в предметные таблицы.
 */
class ExposedDraftChangeHandler(
    override val entityType: String,
    private val stableTable: Table,
    private val stableId: Column<UUID>,
    private val stableDesignSystemId: Column<*>,
    private val revisionTable: Table,
    private val revisionEntityId: Column<UUID>,
    private val revisionVersionId: Column<UUID>,
    private val revisionSequenceNumber: Column<Long>,
    private val revisionDeleted: Column<Boolean>,
    private val stableValueColumns: List<Column<*>> = emptyList(),
    private val revisionValueColumns: List<Column<*>> = emptyList(),
) : DraftChangeHandler {
    override fun describe(
        designSystemId: UUID,
        sequenceNumber: Long,
        previousSequenceNumber: Long,
    ): List<DraftSubjectChange> {
        return differences(designSystemId, sequenceNumber, previousSequenceNumber, stopAfterFirst = false)
    }

    override fun hasChanges(designSystemId: UUID, sequenceNumber: Long, previousSequenceNumber: Long): Boolean =
        differences(designSystemId, sequenceNumber, previousSequenceNumber, stopAfterFirst = true).isNotEmpty()

    override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean {
        val hasHistoricalRevision = removeStableEntity && revisionTable.selectAll().where {
            (revisionEntityId eq entityId) and (revisionVersionId neq versionId)
        }.limit(1).any()
        val revisionRemoved = revisionTable.deleteWhere {
            (revisionEntityId eq entityId) and (revisionVersionId eq versionId)
        } == 1
        if (!revisionRemoved) return false
        return !removeStableEntity || hasHistoricalRevision || stableTable.deleteWhere { stableId eq entityId } == 1
    }

    private fun differences(
        designSystemId: UUID,
        sequenceNumber: Long,
        previousSequenceNumber: Long,
        stopAfterFirst: Boolean,
    ): List<DraftSubjectChange> {
        val previousValue = valueExpression("previous")
        val currentValue = valueExpression("current")
        val previousResolved = resolvedValueExpression("previous", previousValue)
        val currentResolved = resolvedValueExpression("current", currentValue)
        val limit = if (stopAfterFirst) "LIMIT 1" else ""
        val sql = """
            SELECT ${stableTable.qualified(stableId)} AS entity_id,
                   previous.${revisionEntityId.quotedName()} AS previous_exists,
                   previous.${revisionDeleted.quotedName()} AS previous_deleted,
                   $previousValue AS previous_value,
                   current.${revisionEntityId.quotedName()} AS current_exists,
                   current.${revisionDeleted.quotedName()} AS current_deleted,
                   $currentValue AS current_value
            FROM ${stableTable.quotedName()} entity
            LEFT JOIN LATERAL (
                SELECT candidate.*
                FROM ${revisionTable.quotedName()} candidate
                WHERE candidate.${revisionEntityId.quotedName()} = entity.${stableId.quotedName()}
                  AND candidate.${revisionSequenceNumber.quotedName()} <= ?
                ORDER BY candidate.${revisionSequenceNumber.quotedName()} DESC
                LIMIT 1
            ) previous ON true
            LEFT JOIN LATERAL (
                SELECT candidate.*
                FROM ${revisionTable.quotedName()} candidate
                WHERE candidate.${revisionEntityId.quotedName()} = entity.${stableId.quotedName()}
                  AND candidate.${revisionSequenceNumber.quotedName()} <= ?
                ORDER BY candidate.${revisionSequenceNumber.quotedName()} DESC
                LIMIT 1
            ) current ON true
            WHERE entity.${stableDesignSystemId.quotedName()} = ?
              AND ($previousResolved) IS DISTINCT FROM ($currentResolved)
            $limit
        """.trimIndent()
        return TransactionManager.current().exec(
            sql,
            listOf(
                LongColumnType() to previousSequenceNumber,
                LongColumnType() to sequenceNumber,
                UUIDColumnType() to designSystemId,
            ),
        ) { rows ->
            buildList {
                while (rows.next()) {
                    val before = rows.snapshot("previous")?.takeUnless(DraftChangeSnapshot::deleted)?.value
                    val after = rows.snapshot("current")?.takeUnless(DraftChangeSnapshot::deleted)?.value
                    if (before != after) {
                        val entityId = rows.getObject("entity_id", UUID::class.java)
                        add(DraftSubjectChange(entityId, before, after, changedPaths(before, after)))
                        if (stopAfterFirst) break
                    }
                }
            }
        }.orEmpty()
    }

    private fun valueExpression(revisionAlias: String): String {
        val valueColumns = stableValueColumns.map { "entity" to it } +
            revisionValueColumns.map { revisionAlias to it }
        return valueColumns.joinToString(", ", prefix = "jsonb_build_object(", postfix = ")") {
            "'${it.second.name}', ${it.first}.${it.second.quotedName()}"
        }.ifEmpty { "'{}'::jsonb" }
    }

    private fun resolvedValueExpression(revisionAlias: String, valueExpression: String): String =
        "CASE WHEN $revisionAlias.${revisionEntityId.quotedName()} IS NULL " +
            "OR $revisionAlias.${revisionDeleted.quotedName()} THEN NULL ELSE $valueExpression END"

    private fun java.sql.ResultSet.snapshot(prefix: String): DraftChangeSnapshot? {
        if (getObject("${prefix}_exists") == null) return null
        return DraftChangeSnapshot(
            getBoolean("${prefix}_deleted"),
            Json.parseToJsonElement(getString("${prefix}_value")) as JsonObject,
        )
    }

    private fun changedPaths(previous: JsonObject?, current: JsonObject?): Set<String> =
        ((previous?.keys.orEmpty()) + (current?.keys.orEmpty()))
            .filterTo(sortedSetOf()) { key -> previous.value(key) != current.value(key) }
            .mapTo(linkedSetOf()) { key -> "/$key" }

    private fun JsonObject?.value(key: String): JsonElement = this?.get(key) ?: JsonNull

    private fun Table.qualified(column: Column<*>): String =
        "${if (this == stableTable) "entity" else "revision"}.${column.quotedName()}"

    private fun Table.quotedName(): String = tableName.quoteIdentifier()
    private fun Column<*>.quotedName(): String = name.quoteIdentifier()
    private fun String.quoteIdentifier(): String = "\"${replace("\"", "\"\"")}\""
}
