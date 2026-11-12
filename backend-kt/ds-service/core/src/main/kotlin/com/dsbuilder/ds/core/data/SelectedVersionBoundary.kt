package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/**
 * Выбирает опубликованную границу из локального контекста транзакции либо активный
 * черновик при отсутствии `versionId`.
 */
fun selectedVersionBoundary(tableName: String): Op<Boolean> = object : Op<Boolean>() {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append(selectedVersionBoundarySql(tableName))
    }
}

/** Единый SQL-предикат границы: доверенная область ДС, черновик либо явно выбранная публикация. */
fun selectedVersionBoundarySql(tableName: String): String = """
    (ds_request_matches_design_system($tableName.design_system_id) AND (
      (NULLIF(current_setting('ds.version_id', true), '') IS NULL AND $tableName.status = 'draft') OR
      ($tableName.id = NULLIF(current_setting('ds.version_id', true), '')::uuid AND $tableName.status = 'published')))
""".trimIndent()

/** Проверяет, что выбранная историческая версия относится к ожидаемой дизайн-системе. */
fun selectedVersionBelongsTo(designSystemId: UUID): Boolean = TransactionManager.current().exec(
    """
        SELECT CASE
            WHEN NULLIF(current_setting('ds.version_id', true), '') IS NULL THEN true
            ELSE EXISTS (
                SELECT 1
                FROM design_system_versions
                WHERE id = NULLIF(current_setting('ds.version_id', true), '')::uuid
                  AND design_system_id = ?
                  AND status = 'published'
                  AND snapshot IS NULL
            )
        END
    """.trimIndent(),
    listOf(UUIDColumnType() to designSystemId),
) { rows -> rows.next() && rows.getBoolean(1) } ?: false
