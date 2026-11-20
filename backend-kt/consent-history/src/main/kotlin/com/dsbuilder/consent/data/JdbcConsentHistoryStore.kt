package com.dsbuilder.consent.data

import com.dsbuilder.consent.application.ConsentHistoryStore
import com.dsbuilder.consent.domain.ConsentConflict
import com.dsbuilder.consent.domain.ConsentInput
import com.dsbuilder.consent.domain.ConsentPolicy
import com.dsbuilder.consent.domain.ConsentReceipt
import com.dsbuilder.consent.domain.ConsentRecord
import com.dsbuilder.consent.domain.ConsentScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection
import java.sql.ResultSet
import java.sql.SQLException
import java.util.UUID
import javax.sql.DataSource

/** PostgreSQL-журнал с конкуренцией на уникальных ограничениях. */
class JdbcConsentHistoryStore(private val source: DataSource) : ConsentHistoryStore {
    override suspend fun current(scope: ConsentScope): ConsentReceipt? = withContext(Dispatchers.IO) {
        source.connection.use { latest(it, scope) }
    }

    @Suppress("TooGenericExceptionCaught") // Любая ошибка внутри транзакции требует rollback.
    override suspend fun append(scope: ConsentScope, input: ConsentInput, policy: ConsentPolicy): ConsentRecord =
        withContext(Dispatchers.IO) {
            try {
                source.connection.use { connection ->
                    connection.autoCommit = false
                    try {
                        val result = insert(connection, scope, input, policy)
                        connection.commit()
                        result
                    } catch (failure: Exception) {
                        connection.rollback()
                        throw failure
                    }
                }
            } catch (failure: SQLException) {
                if (failure.sqlState != "23505") throw failure
                source.connection.use { connection ->
                    replay(connection, scope, input) ?: throw ConsentConflict()
                }
            }
        }

    private fun insert(
        c: Connection,
        scope: ConsentScope,
        input: ConsentInput,
        active: ConsentPolicy,
    ): ConsentRecord {
        replay(c, scope, input)?.let { return it }
        val previous = latest(c, scope)
        if ((previous?.revision ?: 0L) != input.expectedRevision) throw ConsentConflict()
        val activePolicy = active.version to active.sha256
        val (version, hash) = if (input.decision == "granted") {
            if ((input.policyVersion to input.policySha256) != activePolicy) throw ConsentConflict()
            activePolicy
        } else {
            previous?.let { it.policyVersion to it.policySha256 } ?: activePolicy
        }
        val sql = """INSERT INTO consent.consent_history
            (subject_key_hash,
 client_group,
 revision,
 request_id,
 decision,
 policy_version,
 policy_sha256,
 app_version)
            VALUES (decode(?, 'hex'), ?, ?, ?, ?, ?, decode(?, 'hex'), ?) RETURNING *"""
        val receipt = c.prepareStatement(sql).use { statement ->
            statement.setString(1, scope.subjectHash)
            statement.setString(2, scope.clientGroup)
            statement.setLong(3, input.expectedRevision + 1)
            statement.setObject(4, UUID.fromString(input.requestId))
            statement.setString(5, input.decision)
            statement.setString(6, version)
            statement.setString(7, hash)
            statement.setString(8, input.appVersion)
            statement.executeQuery().use { rows ->
                check(rows.next())
                receipt(rows)
            }
        }
        return ConsentRecord(receipt, receipt, true)
    }

    private fun replay(c: Connection, scope: ConsentScope, input: ConsentInput): ConsentRecord? {
        val row = query(c, scope, "AND request_id = ?", input.requestId) ?: return null
        val sameAction = row.decision == input.decision && row.revision == input.expectedRevision + 1 &&
            row.appVersion == input.appVersion
        val samePolicy = input.decision != "granted" ||
            (row.policyVersion == input.policyVersion && row.policySha256 == input.policySha256)
        if (!sameAction || !samePolicy) throw ConsentConflict()
        return ConsentRecord(row, requireNotNull(latest(c, scope)), false)
    }

    private fun latest(c: Connection, scope: ConsentScope) = query(c, scope, "ORDER BY revision DESC LIMIT 1")

    private fun query(
        c: Connection,
        scope: ConsentScope,
        suffix: String,
        requestId: String? = null,
    ): ConsentReceipt? =
        c.prepareStatement(
            "SELECT * FROM consent.consent_history " +
                "WHERE subject_key_hash = decode(?, 'hex') AND client_group = ? $suffix",
        ).use { statement ->
            statement.setString(1, scope.subjectHash)
            statement.setString(2, scope.clientGroup)
            if (requestId != null) statement.setObject(3, UUID.fromString(requestId))
            statement.executeQuery().use { rows -> if (rows.next()) receipt(rows) else null }
        }

    private fun receipt(row: ResultSet) = ConsentReceipt(
        row.getLong("revision"),
        row.getString("request_id"),
        row.getString("decision"),
        row.getString("policy_version"),
        row.getBytes("policy_sha256").joinToString("") { "%02x".format(it) },
        row.getTimestamp("received_at").toInstant().toString(),
        row.getString("app_version"),
    )
}
