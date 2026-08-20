package com.dsbuilder.projects.feature.projects.data.local.db

import com.dsbuilder.projects.core.DatabaseProvider
import com.dsbuilder.projects.feature.projects.application.port.TransactionManager
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

internal class JdbcTransactionManager(
    private val databaseProvider: DatabaseProvider,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
) : TransactionManager {
    override suspend fun <T> required(block: suspend () -> T): T =
        withContext(dispatcher) {
            transaction(databaseProvider.database) {
                kotlinx.coroutines.runBlocking {
                    block()
                }
            }
        }
}
