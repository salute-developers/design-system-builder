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
        val sqlState = generateSequence(failure) { it.cause }.filterIsInstance<SQLException>()
            .mapNotNull(SQLException::getSQLState).firstOrNull()
        return when {
            sqlState == "23505" && "tenants_design_system_id_name_ci_unique" in messages ->
                DsFailure.Conflict("TENANT_NAME_CONFLICT", transactionFailure = true)
            sqlState == "23505" -> DsFailure.Conflict("constraint_conflict", transactionFailure = true)
            sqlState == "23503" -> DsFailure.InvalidRequest("invalid_reference", transactionFailure = true)
            sqlState == "23502" || sqlState == "23514" || sqlState?.startsWith("22") == true ->
                DsFailure.InvalidRequest("invalid_body", transactionFailure = true)
            else -> DsFailure.TechnicalFailure
        }
    }
}
