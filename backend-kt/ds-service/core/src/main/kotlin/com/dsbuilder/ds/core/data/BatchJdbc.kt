package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.Key
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
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
    fun query(sql: String, vararg args: Any?, operators: Int = 1): List<Map<String, String?>> =
        readArguments(sql, args.asList(), operators = operators) { row ->
            (1..row.metaData.columnCount).associate { index ->
                row.metaData.getColumnLabel(index) to row.getString(index)
            }
        }

    /** Читает явную SQL-проекцию, не превращая предметные типы в строковую карту. */
    fun <T> read(
        sql: String,
        vararg args: Any?,
        operators: Int = 1,
        decode: (ResultSet) -> T,
    ): List<T> =
        readArguments(sql, args.asList(), operators, decode)

    /** Читает подготовленный список параметров без промежуточного массива и spread-копирования. */
    fun <T> readArguments(
        sql: String,
        args: List<Any?>,
        operators: Int = 1,
        decode: (ResultSet) -> T,
    ): List<T> {
        val started = System.nanoTime()
        try {
            return connection.prepareStatement(sql).use { statement ->
                args.forEachIndexed { index, value -> statement.setObject(index + 1, value) }
                results(statement, decode)
            }
        } finally {
            transaction.getUserData(
                activeTransactionDiagnostics,
            )?.recordExecution(1, operators, System.nanoTime() - started)
        }
    }

    private fun <T> results(statement: PreparedStatement, decode: (ResultSet) -> T): List<T> {
        val rows = mutableListOf<T>()
        var result = statement.execute()
        while (result || statement.updateCount != -1) {
            if (result) rows += statement.resultSet.use { readRows(it, decode) }
            result = statement.moreResults
        }
        return rows
    }

    private fun <T> readRows(result: ResultSet, decode: (ResultSet) -> T): List<T> = buildList {
        while (result.next()) add(decode(result))
    }
}

internal val activeTransactionDiagnostics = Key<TransactionDiagnostics>()
