package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.MAX_IDEMPOTENCY_KEY_LENGTH
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.IntegerColumnType
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

/** PostgreSQL-хранилище результатов повторяемых запросов. */
class ExposedIdempotentRequestRepository : IdempotentRequestRepository {
    override suspend fun lookup(
        projectId: ProjectId,
        key: String,
        operation: String,
        requestHash: String,
    ): IdempotentRequestLookup {
        require(key.isNotBlank()) { "Idempotency key is required" }
        require(key.length <= MAX_IDEMPOTENCY_KEY_LENGTH) { "Idempotency key is too long" }
        val lockKey = "idempotency:${projectId.value}:$key"
        TransactionManager.current().exec(
            "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
            listOf(TextColumnType() to lockKey),
        )
        val sql = "SELECT operation, request_hash, response_status, response_body " +
            "FROM idempotent_requests WHERE project_id = ? AND idempotency_key = ?"
        return TransactionManager.current().exec(
            sql,
            listOf(TextColumnType() to projectId.value, TextColumnType() to key),
        ) { rows ->
            if (!rows.next()) return@exec IdempotentRequestLookup.New
            if (rows.getString("operation") != operation || rows.getString("request_hash") != requestHash) {
                IdempotentRequestLookup.PayloadMismatch
            } else {
                IdempotentRequestLookup.Replayed(
                    IdempotentResponse(rows.getInt("response_status"), rows.getString("response_body")),
                )
            }
        } ?: IdempotentRequestLookup.New
    }

    override suspend fun save(
        projectId: ProjectId,
        key: String,
        actorId: String,
        operation: String,
        requestHash: String,
        response: IdempotentResponse,
    ) {
        require(key.length <= MAX_IDEMPOTENCY_KEY_LENGTH) { "Idempotency key is too long" }
        TransactionManager.current().exec(
            """
                INSERT INTO idempotent_requests(
                    project_id, idempotency_key, actor_id, operation, request_hash, response_status, response_body
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            listOf(
                TextColumnType() to projectId.value,
                TextColumnType() to key,
                TextColumnType() to actorId,
                TextColumnType() to operation,
                TextColumnType() to requestHash,
                IntegerColumnType() to response.status,
                TextColumnType() to response.body,
            ),
        )
    }
}
