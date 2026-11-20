package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.update
import org.slf4j.LoggerFactory
import java.time.Instant
import java.util.UUID

/**
 * Разовая задача старта `ds-service`: дописывает вариацию `view` конфигурациям черновиков, у которых её нет.
 *
 * Список дизайн-систем фиксирует миграция `V21__view_axis_backfill.sql`. Каждая дизайн-система обрабатывается
 * в своей транзакции вне HTTP-запроса: записи идут в текущий черновик через [ViewAxis.ensure], журнал получает
 * автора `system`, как и другие серверные записи без контекста запроса. Отметка выполнения ставится в той же
 * транзакции, поэтому повторный запуск ничего не меняет. Опубликованные версии не меняются.
 */
class ViewAxisBackfill(private val transactions: TransactionRunner) {
    /** Обрабатывает дизайн-системы без отметки и возвращает число дописанных осей `view`. */
    suspend fun run(): Int {
        val pending = when (val result = transactions.readOnly { DsResult.Success(pending()) }) {
            is DsResult.Success -> result.value
            is DsResult.Failure -> {
                logger.warn("View axis backfill could not list design systems: {}", result.error)
                return 0
            }
        }
        var created = 0
        pending.forEach { designSystemId ->
            when (val result = transactions.required { DsResult.Success(backfill(designSystemId)) }) {
                is DsResult.Success -> created += result.value
                is DsResult.Failure ->
                    logger.warn("View axis backfill failed for design system {}: {}", designSystemId, result.error)
            }
        }
        if (pending.isNotEmpty()) logger.info("View axis backfill added {} axes", created)
        return created
    }

    private fun pending(): List<UUID> = ViewAxisBackfillTable.selectAll()
        .where { ViewAxisBackfillTable.completedAt.isNull() }
        .map { it[ViewAxisBackfillTable.designSystemId] }

    private fun backfill(designSystemId: UUID): Int {
        val open = ViewAxisBackfillTable.selectAll().where {
            (ViewAxisBackfillTable.designSystemId eq designSystemId) and ViewAxisBackfillTable.completedAt.isNull()
        }.forUpdate().any()
        if (!open) return 0
        val created = if (hasActiveDraft(designSystemId)) {
            ComponentAppearancesTable.selectAll()
                .where { ComponentAppearancesTable.designSystemId eq designSystemId }
                .orderBy(ComponentAppearancesTable.createdAt)
                .toList()
                .count { row ->
                    val componentId = row[ComponentAppearancesTable.componentId]
                    ViewAxis.ensure(designSystemId, componentId, row[ComponentAppearancesTable.id])
                }
        } else {
            0
        }
        ViewAxisBackfillTable.update({ ViewAxisBackfillTable.designSystemId eq designSystemId }) {
            it[completedAt] = Instant.now()
        }
        return created
    }

    /** У дизайн-системы есть черновик, и она не удалена: без черновика писать некуда, опубликованное не меняется. */
    private fun hasActiveDraft(designSystemId: UUID): Boolean = TransactionManager.current().exec(
        """
            SELECT EXISTS (
                SELECT 1 FROM design_system_versions boundary
                JOIN LATERAL (
                    SELECT deleted FROM design_system_revisions revision
                    WHERE revision.design_system_id = boundary.design_system_id
                      AND revision.version_sequence_number <= boundary.sequence_number
                    ORDER BY revision.version_sequence_number DESC LIMIT 1
                ) revision ON NOT revision.deleted
                WHERE boundary.design_system_id = ? AND boundary.status = 'draft'
            )
        """.trimIndent(),
        listOf(UUIDColumnType() to designSystemId),
    ) { rows -> rows.next() && rows.getBoolean(1) } ?: false

    private object ViewAxisBackfillTable : Table("view_axis_backfill") {
        val designSystemId = uuid("design_system_id")
        val completedAt = timestamp("completed_at").nullable()
    }

    private companion object {
        val logger = LoggerFactory.getLogger(ViewAxisBackfill::class.java)
    }
}
