package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.Key
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.util.UUID

/** JDBC-фазы пакетной команды на соединении текущей Exposed-транзакции с полным чтением результатов. */
class BatchJdbc {
    private val transaction = TransactionManager.current()
    private val connection = transaction.connection.connection as Connection

    /** Массив предметных идентификаторов для ANY/unnest без построения длинного IN. */
    fun uuids(values: Collection<UUID>): java.sql.Array = connection.createArrayOf("uuid", values.toTypedArray())

    /** Массив имён для ограниченного чтения семейства. */
    fun texts(values: Collection<String>): java.sql.Array = connection.createArrayOf("text", values.toTypedArray())

    /** Выполняет одну фазу; число SQL-операторов составной фазы указывается явно. */
    fun query(sql: String, vararg args: Any?, operators: Int = 1): List<Map<String, String?>> {
        val started = System.nanoTime()
        try {
            return connection.prepareStatement(sql).use { statement ->
                args.forEachIndexed { index, value -> statement.setObject(index + 1, value) }
                var result = statement.execute()
                val rows = mutableListOf<Map<String, String?>>()
                while (true) {
                    if (result) {
                        statement.resultSet.use { rs ->
                            while (rs.next()) rows += (1..rs.metaData.columnCount)
                                .associate { rs.metaData.getColumnLabel(it) to rs.getString(it) }
                        }
                    } else if (statement.updateCount == -1) break
                    result = statement.moreResults
                }
                rows
            }
        } finally {
            transaction.getUserData(
                activeTransactionDiagnostics,
            )?.recordExecution(1, operators, System.nanoTime() - started)
        }
    }
}

internal val activeTransactionDiagnostics = Key<TransactionDiagnostics>()
