package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.InternalApi
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.statements.InsertStatement
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Согласует импорт по предметным адресам, сохраняя UUID и не переписывая одинаковые редакции. */
internal class ComponentConfigImportSync {
    private val retained = mutableMapOf<ComponentRevisionTable, MutableSet<UUID>>()

    fun retained(table: ComponentRevisionTable, id: UUID): Boolean = id in retained[table].orEmpty()

    @Suppress("UNCHECKED_CAST")
    fun id(view: Table, id: Column<UUID>, vararg address: Pair<Column<*>, Any?>): UUID? {
        val predicate = address.fold<_, Op<Boolean>>(Op.TRUE) { predicate, (column, value) ->
            predicate and ((column as Column<Any?>) eq value)
        }
        return view.selectAll().where { predicate }.singleOrNull()?.get(id)
    }

    @OptIn(InternalApi::class)
    @Suppress("UNCHECKED_CAST")
    fun <T : ComponentRevisionTable> write(
        table: T,
        view: Table,
        entityColumn: Column<UUID>,
        entityId: UUID,
        owner: UUID,
        body: T.(InsertStatement<Number>) -> Unit,
    ) {
        retained.getOrPut(table) { hashSetOf() } += entityId
        val desired = InsertStatement<Number>(table).also { table.body(it) }.values.toMap()
        val idColumn = view.columns.single { it.name == "id" } as Column<UUID>
        val current = view.selectAll().where { idColumn eq entityId }.singleOrNull()
        val columns = view.columns.associateBy { it.name }
        if (current != null && desired.all { (column, value) ->
                current[requireNotNull(columns[column.name]) as Column<Any?>] == value
            }
        ) {
            return
        }
        table.replaceRevision(entityColumn, entityId, owner) { statement ->
            desired.forEach { (column, value) -> statement[column as Column<Any?>] = value }
        }
    }

    fun <T : ComponentRevisionTable> remove(
        table: T,
        entityColumn: Column<UUID>,
        id: UUID,
        owner: UUID,
        body: T.(InsertStatement<Number>) -> Unit = {},
    ) {
        if (!retained(table, id)) table.replaceRevision(entityColumn, id, owner, deleted = true, body = body)
    }
}
