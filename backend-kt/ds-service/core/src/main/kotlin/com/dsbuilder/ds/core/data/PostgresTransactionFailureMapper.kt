package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.TransactionFailureMapper
import java.sql.SQLException

/** Преобразует технические ошибки PostgreSQL в безопасные прикладные ошибки. */
class PostgresTransactionFailureMapper : TransactionFailureMapper {
    /** Возвращает стабильную ошибку для причины неуспешной транзакции. */
    override fun map(failure: Throwable): DsFailure {
        val messages = generateSequence(failure) { it.cause }
            .mapNotNull(Throwable::message)
            .joinToString(" ")
        val sqlStates = generateSequence(failure) { it.cause }.filterIsInstance<SQLException>()
            .mapNotNull(SQLException::getSQLState).toSet()
        return when {
            "23505" in sqlStates && (
                "tenants_design_system_id_name_ci_unique" in messages ||
                    "tenant_revisions_version_name_ci_unique" in messages
                ) ->
                DsFailure.Conflict("TENANT_NAME_CONFLICT", transactionFailure = true)
            "23505" in sqlStates -> DsFailure.Conflict("constraint_conflict", transactionFailure = true)
            "23503" in sqlStates -> DsFailure.InvalidRequest("invalid_reference", transactionFailure = true)
            "23502" in sqlStates || "23514" in sqlStates || sqlStates.any { it.startsWith("22") } ->
                DsFailure.InvalidRequest("invalid_body", transactionFailure = true)
            else -> DsFailure.TechnicalFailure
        }
    }
}
