package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.Transaction

/** Таблица запроса, собирающего сущность на границе активного черновика без отдельного представления в БД. */
internal open class ResolvedRevisionTable(
    alias: String,
    private val sourceSql: String,
) : Table(alias) {
    override fun describe(s: Transaction, queryBuilder: QueryBuilder) {
        queryBuilder.append("(")
        queryBuilder.append(sourceSql)
        queryBuilder.append(") AS ")
        queryBuilder.append(s.identity(this))
    }
}

internal fun resolvedRevisionSql(
    stableTable: String,
    revisionTable: String,
    entityColumn: String,
    stableColumns: List<String>,
    revisionColumns: List<String>,
    computedColumns: List<String> = emptyList(),
): String {
    val selections = buildList {
        addAll(stableColumns.map { "entity.$it AS $it" })
        addAll(revisionColumns.map { "revision.$it AS $it" })
        addAll(computedColumns)
        add("revision.updated_at AS updated_at")
    }.joinToString(", ")
    return """
        SELECT $selections
        FROM $stableTable entity
        JOIN design_system_versions draft
          ON draft.design_system_id = entity.design_system_id
         AND draft.id = COALESCE(
              NULLIF(current_setting('ds.version_id', true), '')::uuid,
              (SELECT active.id FROM design_system_versions active
               WHERE active.design_system_id = entity.design_system_id AND active.status = 'draft')
         )
         AND draft.status IN ('draft', 'published')
        JOIN $revisionTable revision
          ON revision.$entityColumn = entity.id
         AND revision.version_sequence_number <= draft.sequence_number
        WHERE NOT revision.deleted
          AND revision.version_sequence_number = (
              SELECT max(candidate.version_sequence_number)
              FROM $revisionTable candidate
              WHERE candidate.$entityColumn = entity.id
                AND candidate.version_sequence_number <= draft.sequence_number
          )
    """.trimIndent()
}
