package com.dsbuilder.feature.publisher.data.local.db

import com.dsbuilder.core.DatabaseProvider
import com.dsbuilder.feature.publisher.application.TransactionManager
import com.dsbuilder.feature.publisher.application.TransactionWrapper
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager as JdbcTransactionManager

internal class JdbcTransactionManager(
    private val dbProvider: DatabaseProvider,
    private val dbDispatcher: CoroutineDispatcher = Dispatchers.IO
) : TransactionManager {
    override suspend fun <T> required(block: TransactionWrapper.() -> T): T =
        withContext(dbDispatcher) {
            val tx = JdbcTransactionManager.currentOrNull()
            if (tx != null) {
                // Уже внутри транзакции → просто выполнить блок
                JdbcTransactionWrapper(tx).block()
            } else {
                // Открыть новую транзакцию и выполнить блок
                transaction(dbProvider.database) {
                    JdbcTransactionWrapper(this).block()
                }
            }
        }
}

private class JdbcTransactionWrapper(private val raw: JdbcTransaction): TransactionWrapper {
    override fun rollback() {
        raw.rollback()
    }

}