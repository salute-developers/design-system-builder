package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.statements.BatchInsertStatement
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

/**
 * Пакетно записывает конфигурации компонентов из шаблонов в границу версий [boundary]: в базовую версию при создании
 * ДС или в текущий черновик при добавлении компонента в существующую ДС.
 */
internal class ComponentSeedBatchWriter private constructor(
    private val designSystemId: UUID,
    private val boundary: ResultRow,
) {
    private val stableRows = linkedMapOf<Table, MutableList<BatchInsertStatement.() -> Unit>>()
    private val revisionRows = linkedMapOf<Table, MutableList<BatchInsertStatement.() -> Unit>>()

    fun <T : Table> stable(
        table: T,
        idColumn: Column<UUID>,
        createdAtColumn: Column<Instant>,
        body: T.(BatchInsertStatement) -> Unit,
    ): UUID {
        val id = UUID.randomUUID()
        stableRows.getOrPut(table) { mutableListOf() }.add {
            this[idColumn] = id
            this[createdAtColumn] = Instant.now()
            table.body(this)
        }
        return id
    }

    fun <T : ComponentRevisionTable> revision(
        table: T,
        entityColumn: Column<UUID>,
        entityId: UUID,
        body: T.(BatchInsertStatement) -> Unit = {},
    ) {
        revisionRows.getOrPut(table) { mutableListOf() }.add {
            this[table.id] = UUID.randomUUID()
            this[entityColumn] = entityId
            this[table.designSystemId] = designSystemId
            this[table.designSystemVersionId] = boundary[ComponentVersionBoundariesTable.id]
            this[table.versionSequenceNumber] = boundary[ComponentVersionBoundariesTable.sequenceNumber]
            this[table.deleted] = false
            this[table.updatedAt] = Instant.now()
            table.body(this)
        }
    }

    fun flush() {
        // Родительские устойчивые строки регистрируются раньше дочерних. Их FK должны существовать
        // до записи редакций; предметные триггеры и отложенные проверки остаются включены.
        flush(stableRows)
        flush(revisionRows)
        stableRows.clear()
        revisionRows.clear()
    }

    private fun flush(rowsByTable: Map<Table, List<BatchInsertStatement.() -> Unit>>) {
        rowsByTable.forEach { (table, rows) ->
            rows.chunked(250).forEach { batch ->
                table.batchInsert(batch, shouldReturnGeneratedValues = false) { row -> row(this) }
            }
        }
    }

    companion object {
        /** Базовая версия новой ДС: запись возможна только до открытия первого черновика. */
        fun baseline(designSystemId: UUID): ComponentSeedBatchWriter {
            check(
                !ComponentVersionBoundariesTable.selectAll().where {
                    (ComponentVersionBoundariesTable.designSystemId eq designSystemId) and
                        (ComponentVersionBoundariesTable.status eq ComponentVersionBoundaryStatus.DRAFT)
                }.limit(1).any(),
            ) { "Component initialization must precede the first draft" }
            val baseline = ComponentVersionBoundariesTable.selectAll().where {
                (ComponentVersionBoundariesTable.designSystemId eq designSystemId) and
                    (ComponentVersionBoundariesTable.status eq ComponentVersionBoundaryStatus.BASELINE)
            }.single()
            return ComponentSeedBatchWriter(designSystemId, baseline)
        }

        /** Текущий черновик существующей ДС: записи видны в журнале и откатываются. */
        fun draft(designSystemId: UUID): ComponentSeedBatchWriter =
            ComponentSeedBatchWriter(designSystemId, componentDraft(designSystemId))
    }
}
