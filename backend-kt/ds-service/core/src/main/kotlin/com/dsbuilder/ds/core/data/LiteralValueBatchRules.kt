package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.LiteralValueBatchParticipant
import org.slf4j.LoggerFactory

/** Собирает исполняемые правила; неизвестный участник явно переводит команду на общий путь. */
fun literalValueBatchParticipants(participants: List<Any>): List<LiteralValueBatchParticipant>? {
    val missing = participants.firstOrNull { it !is LiteralValueBatchParticipant }
    if (missing != null) {
        literalBatchLogger.warn("Literal batch uses generic revert: no batch rule for {}", missing.javaClass.name)
        return null
    }
    return participants.filterIsInstance<LiteralValueBatchParticipant>()
}

private val literalBatchLogger = LoggerFactory.getLogger("ds.literal-value-batch")
