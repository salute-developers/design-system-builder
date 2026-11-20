package com.dsbuilder.ds.app

import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.core.statements.GlobalStatementInterceptor
import org.jetbrains.exposed.v1.core.statements.StatementContext
import org.jetbrains.exposed.v1.core.statements.api.PreparedStatementApi
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Считает обращения Exposed к базе во всех транзакциях тестового процесса. Подключается через ServiceLoader
 * (`META-INF/services`), поэтому видит и транзакции, которые открывают HTTP-маршруты. Измерение берётся разностью
 * [snapshot] до и после запроса: параллельной работы вне запроса в этих тестах нет.
 */
class QueryCounter : GlobalStatementInterceptor {
    override fun afterExecution(
        transaction: Transaction,
        contexts: List<StatementContext>,
        executedStatement: PreparedStatementApi,
    ) {
        executions.incrementAndGet()
        statements.addAndGet(contexts.size.toLong())
        if (profiling.get()) {
            val sql = contexts.first().sql(transaction)
            byKind.computeIfAbsent(kind(sql)) { AtomicLong() }.addAndGet(contexts.size.toLong())
        }
    }

    /** Показания счётчика на момент вызова. */
    data class Snapshot(val executions: Long, val statements: Long, val byKind: Map<String, Long>) {
        /** Разность показаний: что произошло между двумя вызовами [QueryCounter.snapshot]. */
        operator fun minus(before: Snapshot) = Snapshot(
            executions - before.executions,
            statements - before.statements,
            byKind.mapValues { (kind, count) -> count - before.byKind.getOrDefault(kind, 0L) }
                .filterValues { it != 0L },
        )
    }

    companion object {
        private val executions = AtomicLong()
        private val statements = AtomicLong()
        private val byKind = ConcurrentHashMap<String, AtomicLong>()
        private const val SETTINGS_PREVIEW = 110
        private val profiling = java.util.concurrent.atomic.AtomicBoolean(false)

        /** Включает разбивку по таблице и виду операции; без неё считаются только итоги. */
        fun profile(enabled: Boolean) = profiling.set(enabled)

        /** Текущие показания. */
        fun snapshot() = Snapshot(executions.get(), statements.get(), byKind.mapValues { it.value.get() })

        private fun kind(sql: String): String {
            val trimmed = sql.trimStart()
            val verb = trimmed.substringBefore(' ').uppercase()
            return when (verb) {
                "SELECT" -> {
                    val from = Regex("(?i)\\bfrom\\s+\"?([a-z_]+)\"?").find(trimmed)?.groupValues?.get(1)
                    if (trimmed.contains("pg_advisory", ignoreCase = true) ||
                        trimmed.contains("set_config", ignoreCase = true) ||
                        trimmed.contains("current_setting", ignoreCase = true)
                    ) {
                        "SELECT <settings/locks> ${trimmed.take(SETTINGS_PREVIEW).replace('\n', ' ')}"
                    } else {
                        "SELECT ${from ?: "?"}"
                    }
                }
                "INSERT" -> "INSERT ${Regex("(?i)into\\s+\"?([a-z_]+)\"?").find(trimmed)?.groupValues?.get(1) ?: "?"}"
                "UPDATE" -> "UPDATE ${Regex("(?i)update\\s+\"?([a-z_]+)\"?").find(trimmed)?.groupValues?.get(1) ?: "?"}"
                "DELETE" -> "DELETE ${Regex("(?i)from\\s+\"?([a-z_]+)\"?").find(trimmed)?.groupValues?.get(1) ?: "?"}"
                else -> verb
            }
        }
    }
}
