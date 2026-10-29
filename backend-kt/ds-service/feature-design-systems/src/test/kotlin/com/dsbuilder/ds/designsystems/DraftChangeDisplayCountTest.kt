package com.dsbuilder.ds.designsystems

import com.dsbuilder.ds.designsystems.domain.ChangeOperation
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChange
import com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

/** Сводка считает те же отдельные параметры и структурные строки, что представление журнала. */
class DraftChangeDisplayCountTest {
    @Test
    fun `typography parameters unwrap and normalize editor units`() {
        assertCount(
            "typography",
            """[{"fontSize":"1rem","lineHeight":"20px"}]""",
            """[{"fontSize":"2rem","lineHeight":"24px"}]""",
            2,
        )
        assertCount(
            "typography",
            """[{"fontSize":"1rem","fontWeight":400}]""",
            """[{"fontSize":16,"fontWeight":500}]""",
            1,
        )
        assertCount(
            "typography",
            """{"letterSpacing":"normal","fontWeight":400}""",
            """{"letterSpacing":0,"fontWeight":500}""",
            1,
        )
    }

    @Test
    fun `shadow fields split but layer insertion and movement stay structural`() {
        assertCount("shadow", """["0px 1px 2px 3px #000"]""", """["1px 2px 2px 3px #000"]""", 2)
        assertCount("shadow", """["0 1 2 3 #000"]""", """["0 1 2 3 #000","1 2 3 4 #FFF"]""", 1)
        assertCount("gradient", """[{"color":"#000"},{"color":"#FFF"}]""", """[{"color":"#FFF"},{"color":"#000"}]""", 1)
    }

    @Test
    fun `metadata technical fields and non token entities do not inflate count`() {
        assertCount("typography", """{"fontSize":16,"id":"a"}""", """{"fontSize":20,"id":"b"}""", 1)
        val change = change("{}", "{}").copy(entityType = "palette-ramp", operation = ChangeOperation.CREATED)
        assertEquals(1, draftChangeDisplayCount(listOf(change), emptyMap()))
        assertEquals(0, draftChangeDisplayCount(emptyList(), emptyMap()))
    }

    private fun assertCount(type: String, before: String, after: String, expected: Int) {
        assertEquals(expected, draftChangeDisplayCount(listOf(change(before, after)), mapOf(token to type)))
    }

    private fun change(before: String, after: String) = DraftChange(
        UUID.randomUUID(), DesignSystemVersionId(UUID.randomUUID()), DesignSystemId(UUID.randomUUID()),
        "token-value", UUID.randomUUID(), ChangeOperation.UPDATED, setOf("/value"),
        JsonObject(mapOf("token_id" to JsonPrimitive(token.toString()), "value" to Json.parseToJsonElement(before))),
        JsonObject(mapOf("token_id" to JsonPrimitive(token.toString()), "value" to Json.parseToJsonElement(after))),
        "user", Instant.EPOCH, 1,
    )

    private val token = UUID.randomUUID()
}
