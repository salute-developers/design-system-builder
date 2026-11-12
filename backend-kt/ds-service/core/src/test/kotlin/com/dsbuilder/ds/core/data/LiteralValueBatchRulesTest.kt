package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.LiteralValueBatchContext
import com.dsbuilder.ds.core.application.LiteralValueBatchParticipant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/** Пакетный контракт исполняет правила и явно отказывается от неизвестного участника. */
class LiteralValueBatchRulesTest {
    @Test
    fun `registered participants inspect the locked context and may reject specialization`() {
        val context = LiteralValueBatchContext(UUID.randomUUID(), UUID.randomUUID(), emptyList(), emptyList())
        val calls = mutableListOf<String>()
        val first = LiteralValueBatchParticipant { seen ->
            assertEquals(context, seen)
            calls += "policy"
            true
        }
        val second = LiteralValueBatchParticipant { seen ->
            calls += "validator"
            seen.values.isNotEmpty()
        }
        val rules = assertNotNull(literalValueBatchParticipants(listOf(first, second)))
        assertFalse(rules.all { it.validLiteralBatch(context) })
        assertEquals(listOf("policy", "validator"), calls)
    }

    @Test
    fun `unadapted participant cannot enable a path bypassing its ordinary validation`() {
        val rule = LiteralValueBatchParticipant { true }
        assertNull(literalValueBatchParticipants(listOf(rule, Any())))
    }
}
