package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Номер той же предметной границы, на которой собираются конфигурации выгрузки. */
internal fun componentExportVersion(owner: UUID): String? = TransactionManager.current().exec(
    """
    SELECT CASE WHEN boundary.status = 'published' THEN boundary.version ELSE 'draft' END
    FROM design_system_versions boundary
    WHERE boundary.design_system_id = ? AND boundary.status IN ('draft', 'published') AND boundary.snapshot IS NULL
      AND boundary.id = COALESCE(NULLIF(current_setting('ds.version_id', true), '')::uuid,
          (SELECT active.id FROM design_system_versions active
           WHERE active.design_system_id = boundary.design_system_id AND active.status = 'draft'))
    """.trimIndent(),
    listOf(UUIDColumnType() to owner),
) { rows -> if (rows.next()) rows.getString(1) else null }
