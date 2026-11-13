package com.dsbuilder.ds.app

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import jdk.jfr.Configuration
import jdk.jfr.Recording
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import java.nio.file.Path

/** Существующие серверные HTTP-замеры отдельно от получения и разбора тела измерительным клиентом. */
internal class PerformanceHttpTimings : AutoCloseable {
    private val root = LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME) as Logger
    private val previous = root.level
    private val events = ListAppender<ILoggingEvent>().apply { start() }
    private val profile = System.getProperty("ds.performance.jfr").orEmpty()
    private val recording = profile.takeIf { it.isNotBlank() }?.let {
        Recording(Configuration.getConfiguration("profile")).apply { start() }
    }

    init {
        root.addAppender(events)
        root.level = Level.INFO
    }

    /** Медиана последних двадцати завершённых запросов этой последовательной серии. */
    fun median(): Double? {
        val times = events.list.mapNotNull { event ->
            val value = runCatching { Json.parseToJsonElement(event.formattedMessage).jsonObject }.getOrNull()
            value?.takeIf { it["event"]?.jsonPrimitive?.content == "http_request" }
                ?.get("durationMs")?.jsonPrimitive?.content?.toDoubleOrNull()
        }.takeLast(20).sorted()
        return if (times.size == 20) (times[9] + times[10]) / 2 else null
    }

    override fun close() {
        try {
            recording?.use {
                it.stop()
                it.dump(Path.of(profile))
            }
        } finally {
            root.level = previous
            root.detachAppender(events)
            events.stop()
        }
    }
}
