package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** PostgreSQL advisory-lock для нормализованного предметного ключа. */
class PostgresUniqueKeyLockRepository : UniqueKeyLockRepository {
    override suspend fun lock(designSystemId: UUID, entityType: String, normalizedKey: String) {
        val lockKey = "$designSystemId:$entityType:$normalizedKey"
        TransactionManager.current().exec(
            "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
            listOf(TextColumnType() to lockKey),
        )
    }
}
