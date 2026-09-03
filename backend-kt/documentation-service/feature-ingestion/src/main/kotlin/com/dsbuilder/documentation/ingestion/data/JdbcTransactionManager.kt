package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.TransactionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

/** JDBC transaction manager для атомарной записи bundle/job. */
class JdbcTransactionManager(private val database: Database) : TransactionManager {
    override suspend fun <T> transaction(block: suspend () -> T): T = withContext(Dispatchers.IO) {
        transaction(database) { runBlocking { block() } }
    }
}
