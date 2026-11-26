package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Устанавливает уже авторизованную предметную границу для внутренних составных чтений. */
suspend fun <T> withCoreReadScope(designSystemId: UUID, versionId: UUID?, block: suspend () -> T): T {
    val tx = TransactionManager.current()
    val previous = tx.exec(
        "SELECT current_setting('ds.design_system_id', true), current_setting('ds.version_id', true)",
    ) {
            rows ->
        rows.next()
        rows.getString(1).orEmpty() to rows.getString(2).orEmpty()
    } ?: ("" to "")
    fun set(system: String, version: String) {
        tx.exec(
            "SELECT set_config('ds.design_system_id', ?, true), set_config('ds.version_id', ?, true)",
            listOf(TextColumnType() to system, TextColumnType() to version),
        )
    }
    set(designSystemId.toString(), versionId?.toString().orEmpty())
    return try { block() } finally { set(previous.first, previous.second) }
}
