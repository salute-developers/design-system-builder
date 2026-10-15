package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

/** Передаёт триггеру точные предметные пути одной записи. */
object SubjectMutationPaths {
    /** Выполняет запись с локальным для транзакции набором JSON-путей. */
    fun <T> with(paths: Set<String>, block: () -> T): T = with(paths, null, block)

    /** Выполняет запись с отдельной базовой ревизией конкретной сущности. */
    fun <T> with(paths: Set<String>, baseRevision: Long?, block: () -> T): T {
        require(paths.isNotEmpty())
        require(paths.none { ',' in it })
        val value = paths.sorted().joinToString(",")
        val previousBaseRevision = TransactionManager.current().exec(
            "SELECT current_setting('ds.base_revision', true)",
        ) { rows -> if (rows.next()) rows.getString(1) else null }
        TransactionManager.current().exec(
            "SELECT set_config('ds.changed_paths', ?, true)",
            listOf(TextColumnType() to value),
        )
        baseRevision?.let {
            TransactionManager.current().exec(
                "SELECT set_config('ds.base_revision', ?, true)",
                listOf(TextColumnType() to it.toString()),
            )
        }
        return try {
            block()
        } finally {
            TransactionManager.current().exec("SELECT set_config('ds.changed_paths', '', true)")
            if (baseRevision != null) {
                TransactionManager.current().exec(
                    "SELECT set_config('ds.base_revision', ?, true)",
                    listOf(TextColumnType() to previousBaseRevision.orEmpty()),
                )
            }
        }
    }
}
