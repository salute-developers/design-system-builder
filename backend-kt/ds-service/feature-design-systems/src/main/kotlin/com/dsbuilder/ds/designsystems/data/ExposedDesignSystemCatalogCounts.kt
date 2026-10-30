package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.application.DesignSystemCatalogCounts
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

/** Агрегирует собственные данные DS внутри транзакции своей подсистемы. */
class ExposedDesignSystemCatalogCounts(private val transactions: TransactionRunner) : DesignSystemCatalogCounts {
    override suspend fun count(projectIds: List<String>): Map<String, Int> {
        require(projectIds.size <= 500 && projectIds.all(String::isNotBlank))
        if (projectIds.isEmpty()) return emptyMap()
        val ids = projectIds.distinct()
        val result = transactions.readOnly {
            val counts = ids.associateWith { 0 }.toMutableMap()
            val placeholders = ids.joinToString(",") { "?" }
            TransactionManager.current().exec(
                """
                SELECT entity.project_id, count(*) AS total
                FROM design_systems entity
                JOIN design_system_versions boundary
                  ON boundary.design_system_id = entity.id AND boundary.status = 'draft'
                JOIN LATERAL (
                    SELECT revision.deleted FROM design_system_revisions revision
                    WHERE revision.design_system_id = entity.id
                      AND revision.version_sequence_number <= boundary.sequence_number
                    ORDER BY revision.version_sequence_number DESC LIMIT 1
                ) current_revision ON NOT current_revision.deleted
                WHERE entity.project_id IN ($placeholders)
                GROUP BY entity.project_id
                """.trimIndent(),
                ids.map { TextColumnType() to it },
            ) { rows ->
                while (rows.next()) counts[rows.getString("project_id")] = rows.getInt("total")
            }
            DsResult.Success(counts.toMap())
        }
        return when (result) {
            is DsResult.Success -> result.value
            is DsResult.Failure -> error("Design-system catalog counts unavailable")
        }
    }
}
