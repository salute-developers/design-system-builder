package com.dsbuilder.ds.core.data

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.jetbrains.exposed.v1.core.Key
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.core.statements.StatementContext
import org.jetbrains.exposed.v1.core.statements.StatementInterceptor
import org.jetbrains.exposed.v1.core.statements.api.PreparedStatementApi
import org.slf4j.LoggerFactory

/** Измерения включаются только через DS_QUERY_DIAGNOSTICS=true и не содержат SQL и его параметров. */
internal class TransactionDiagnostics(
    private val readOnly: Boolean,
    private val attempt: Int,
    private val poolState: (() -> Map<String, Int>)? = null,
) : StatementInterceptor {
    private val poolBefore = poolState?.invoke()
    private var poolConnected: Map<String, Int>? = null
    private val started = System.nanoTime()
    private var connected = started
    private var statementStarted = started
    private var commitStarted = started
    private var commitNanos = 0L
    private var sqlNanos = 0L
    private var statements = 0
    private var jdbcExecutions = 0
    private var batchExecutions = 0
    private var batchItems = 0
    private var sqlOperators = 0
    private var correlationId = ""

    fun connected() {
        connected = System.nanoTime()
        poolConnected = poolState?.invoke()
    }

    override fun beforeExecution(transaction: Transaction, context: StatementContext) {
        statementStarted = System.nanoTime()
    }

    override fun afterExecution(
        transaction: Transaction,
        contexts: List<StatementContext>,
        executedStatement: PreparedStatementApi,
    ) {
        recordExecution(contexts.size, contexts.size, System.nanoTime() - statementStarted)
    }

    internal fun recordExecution(contexts: Int, operators: Int, nanos: Long) {
        statements += contexts
        sqlOperators += operators
        jdbcExecutions++
        if (contexts > 1) {
            batchExecutions++
            batchItems += contexts
        }
        sqlNanos += nanos
    }

    override fun beforeCommit(transaction: Transaction) {
        commitStarted = System.nanoTime()
        correlationId = transaction.getUserData(DIAGNOSTIC_CORRELATION).orEmpty()
    }

    override fun afterCommit(transaction: Transaction) {
        commitNanos += System.nanoTime() - commitStarted
    }

    override fun beforeRollback(transaction: Transaction) {
        correlationId = transaction.getUserData(DIAGNOSTIC_CORRELATION).orEmpty()
    }

    fun finished(success: Boolean) {
        logger.info(
            buildJsonObject {
                put("event", JsonPrimitive("ds_transaction"))
                put("correlationId", JsonPrimitive(correlationId))
                put("readOnly", JsonPrimitive(readOnly))
                put("attempt", JsonPrimitive(attempt))
                put("success", JsonPrimitive(success))
                put("sqlCount", JsonPrimitive(statements))
                put("jdbcExecutions", JsonPrimitive(jdbcExecutions))
                put("jdbcBatchExecutions", JsonPrimitive(batchExecutions))
                put("jdbcBatchItems", JsonPrimitive(batchItems))
                put("sqlOperators", JsonPrimitive(sqlOperators))
                put("sqlMs", JsonPrimitive(sqlNanos / NANOS_PER_MS))
                put("connectionMs", JsonPrimitive((connected - started) / NANOS_PER_MS))
                put("commitMs", JsonPrimitive(commitNanos / NANOS_PER_MS))
                put("totalMs", JsonPrimitive((System.nanoTime() - started) / NANOS_PER_MS))
                poolBefore?.let { state ->
                    put(
                        "poolBefore",
                        buildJsonObject {
                            state.forEach { (key, value) ->
                                put(
                                    key,
                                    JsonPrimitive(value),
                                )
                            }
                        },
                    )
                }
                poolConnected?.let { state ->
                    put(
                        "poolConnected",
                        buildJsonObject {
                            state.forEach { (key, value) ->
                                put(
                                    key,
                                    JsonPrimitive(value),
                                )
                            }
                        },
                    )
                }
            }.toString(),
        )
    }

    companion object {
        private const val NANOS_PER_MS = 1_000_000L
        private val logger = LoggerFactory.getLogger(TransactionDiagnostics::class.java)

        fun start(
            readOnly: Boolean,
            attempt: Int,
            poolState: (
                () -> Map<
                    String,
                    Int,
                    >
            )? = null,
        ): TransactionDiagnostics? =
            if (System.getenv("DS_QUERY_DIAGNOSTICS") == "true") {
                TransactionDiagnostics(readOnly, attempt, poolState)
            } else {
                null
            }
    }
}

internal val DIAGNOSTIC_CORRELATION = Key<String>()
