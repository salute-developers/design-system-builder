package com.dsbuilder.ds.core.data

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Диагностика публикует только разрешённые поля, без SQL, параметров и предметных значений. */
class TransactionDiagnosticsTest {
    @Test
    fun `transaction event contains only bounded timing metadata`() {
        val logger = LoggerFactory.getLogger(TransactionDiagnostics::class.java) as Logger
        val appender = ListAppender<ILoggingEvent>().apply { start() }
        logger.addAppender(appender)
        try {
            val diagnostics = TransactionDiagnostics(true, 2)
            diagnostics.connected()
            diagnostics.recordExecution(1, 3, 1_000_000)
            diagnostics.recordExecution(5, 5, 2_000_000)
            diagnostics.finished(true)
            val message = Json.parseToJsonElement(appender.list.single().formattedMessage).jsonObject
            assertEquals(
                setOf(
                    "event", "correlationId", "readOnly", "attempt", "success", "sqlCount",
                    "sqlMs", "connectionMs", "commitMs", "totalMs",
                    "jdbcExecutions", "jdbcBatchExecutions", "jdbcBatchItems",
                    "sqlOperators",
                ),
                message.keys,
            )
            assertEquals("ds_transaction", message.getValue("event").jsonPrimitive.content)
            assertEquals("2", message.getValue("attempt").jsonPrimitive.content)
            assertEquals("6", message.getValue("sqlCount").jsonPrimitive.content)
            assertEquals("2", message.getValue("jdbcExecutions").jsonPrimitive.content)
            assertEquals("1", message.getValue("jdbcBatchExecutions").jsonPrimitive.content)
            assertEquals("5", message.getValue("jdbcBatchItems").jsonPrimitive.content)
            assertEquals("8", message.getValue("sqlOperators").jsonPrimitive.content)
            assertEquals("3", message.getValue("sqlMs").jsonPrimitive.content)
            assertTrue(message.getValue("totalMs").jsonPrimitive.content.toLong() >= 0)
        } finally {
            logger.detachAppender(appender)
            appender.stop()
        }
    }
}
