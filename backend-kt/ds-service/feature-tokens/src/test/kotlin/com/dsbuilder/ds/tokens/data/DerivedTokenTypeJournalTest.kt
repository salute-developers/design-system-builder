package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.application.TokenRevertListener
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Производный тип цветового токена не показывается в журнале. */
class DerivedTokenTypeJournalTest {
    @Test
    fun `type only change of a color token is hidden`() {
        assertNull(withoutDerivedType(change(token("accent", "color"), token("accent", "gradient"))))
        assertNull(withoutDerivedType(change(token("accent", "gradient"), token("accent", "color"))))
    }

    @Test
    fun `type is dropped from other paths of a color token`() {
        val renamed = withoutDerivedType(change(token("accent", "color"), token("brand", "gradient")))
        assertEquals(setOf("/name"), renamed?.changedPaths)
    }

    @Test
    fun `other token types and created tokens keep the type path`() {
        val typography = change(token("accent", "typography"), token("accent", "shadow"))
        assertEquals(typography, withoutDerivedType(typography))
        val created = DraftSubjectChange(UUID.randomUUID(), null, token("accent", "gradient"), setOf("/name", "/type"))
        assertEquals(created, withoutDerivedType(created))
    }

    @Test
    fun `definition revert prepares listeners before the subject lock`() {
        val prepared = mutableListOf<UUID>()
        val listener = object : TokenRevertListener {
            override fun beforeRevert(designSystemId: UUID, tokenId: UUID): () -> Unit = {}

            override fun prepareRevert(designSystemId: UUID, tokenId: UUID): Boolean {
                prepared += tokenId
                return tokenId != REFUSED
            }
        }
        val handlers = tokenDraftChangeHandlers(listOf(listener)).associateBy { it.entityType }
        val token = UUID.randomUUID()

        assertTrue(handlers.getValue(TOKEN_DRAFT_ENTITY_TYPE).prepareRevert(UUID.randomUUID(), token))
        assertFalse(handlers.getValue(TOKEN_DRAFT_ENTITY_TYPE).prepareRevert(UUID.randomUUID(), REFUSED))
        assertEquals(listOf(token, REFUSED), prepared)
    }

    private fun change(previous: JsonObject, current: JsonObject) = DraftSubjectChange(
        UUID.randomUUID(),
        previous,
        current,
        previous.keys.filter { previous[it] != current[it] }.mapTo(linkedSetOf()) { "/$it" },
    )

    private fun token(name: String, type: String) =
        JsonObject(mapOf("name" to JsonPrimitive(name), "type" to JsonPrimitive(type)))

    private companion object {
        val REFUSED: UUID = UUID.fromString("00000000-0000-4000-8000-00000000000f")
    }
}
