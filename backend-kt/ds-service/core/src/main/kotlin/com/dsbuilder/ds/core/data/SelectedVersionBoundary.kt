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
        queryBuilder.append("(ds_request_matches_design_system($tableName.design_system_id) AND ((")
        queryBuilder.append("NULLIF(current_setting('ds.version_id', true), '') IS NULL AND ")
        queryBuilder.append(tableName)
        queryBuilder.append(
            ".status = 'draft') OR (NULLIF(current_setting('ds.version_id', true), '') IS NOT NULL AND ",
        )
        queryBuilder.append(tableName)
        queryBuilder.append(".id = NULLIF(current_setting('ds.version_id', true), '')::uuid AND ")
        queryBuilder.append(tableName)
        queryBuilder.append(".status = 'published')))")
    }
}

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

/** Идентификатор разрешённой опубликованной границы текущего запроса. */
fun selectedVersionId(): UUID? = TransactionManager.current().exec(
    "SELECT NULLIF(current_setting('ds.version_id', true), '')::uuid",
) { rows -> if (rows.next()) rows.getObject(1, UUID::class.java) else null }
