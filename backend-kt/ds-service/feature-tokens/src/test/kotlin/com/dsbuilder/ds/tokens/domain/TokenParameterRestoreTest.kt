package com.dsbuilder.ds.tokens.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** Проверки восстановления одного параметра без изменения остальных значений. */
class TokenParameterRestoreTest {
    private fun json(value: String) = Json.parseToJsonElement(value)

    @Test
    fun `color undo preserves palette reference as a native string`() {
        for (reference in listOf("[general.green.500]", "[additional.herbal.400][0.5]")) {
            val palette = json("""["$reference"]""")
            val hex = json("""["#ABCDEF"]""")
            assertEquals(palette, TokenParameterRestore.restore(palette, hex, setOf("/value"), TokenType.COLOR))
            assertEquals(hex, TokenParameterRestore.restore(hex, palette, setOf("/value"), TokenType.COLOR))
        }
    }

    @Test
    fun `gradient layer palette reference is not decoded into a nested array`() {
        val before = json("""["[general.green.500]","#FFFFFF"]""")
        val after = json("""["#ABCDEF","#FFFFFF"]""")
        assertEquals(before, TokenParameterRestore.restore(before, after, setOf("/value/0"), TokenType.GRADIENT))
    }

    @Test
    fun `color undo does not preserve accidental extra JSON quotes`() {
        assertEquals(
            json("""["#108E26"]"""),
            TokenParameterRestore.restore(
                json("""["#108E26"]"""),
                json("""["\"#108E26\""]"""),
                setOf("/value"),
                TokenType.COLOR,
            ),
        )
        assertEquals(
            json("""["#108E26"]"""),
            TokenParameterRestore.restore(
                json("""["\"#108E26\""]"""),
                json("""["#FFFFFF"]"""),
                setOf("/value"),
                TokenType.COLOR,
            ),
        )
    }

    @Test
    fun `restores only the selected typography parameter`() {
        val before = json("""{"fontSize":"8.125rem","lineHeight":"8.75rem"}""")
        val after = json("""{"fontSize":"7.5rem","lineHeight":"8.25rem"}""")
        assertEquals(
            json("""{"fontSize":"8.125rem","lineHeight":"8.25rem"}"""),
            TokenParameterRestore.restore(before, after, setOf("/value/fontSize"), TokenType.TYPOGRAPHY),
        )
    }

    @Test
    fun `restores typography parameter across legacy wrappers and preserves current encoding`() {
        val before = json("""[{"fontSize":"1rem","lineHeight":"1.5rem"}]""")
        val after = json("""{"fontSize":"2rem","lineHeight":"2.5rem"}""")
        val expected = json("""{"fontSize":"1rem","lineHeight":"2.5rem"}""")
        assertEquals(
            expected,
            TokenParameterRestore.restore(before, after, setOf("/value/fontSize"), TokenType.TYPOGRAPHY),
        )
        assertEquals(
            json("[$expected]"),
            TokenParameterRestore.restore(before, json("[$after]"), setOf("/value/fontSize"), TokenType.TYPOGRAPHY),
        )
        assertEquals(
            JsonPrimitive("[$expected]"),
            TokenParameterRestore.restore(
                before,
                JsonPrimitive("[$after]"),
                setOf("/value/fontSize"),
                TokenType.TYPOGRAPHY,
            ),
        )
    }

    @Test
    fun `restores font family parameter across legacy wrappers without changing fonts`() {
        val before = json("""[{"name":"A","fonts":[]}]""")
        val after = json("""{"name":"B","fonts":["custom.woff2"]}""")
        val expected = json("""{"name":"A","fonts":["custom.woff2"]}""")
        assertEquals(
            expected,
            TokenParameterRestore.restore(before, after, setOf("/value/name"), TokenType.FONT_FAMILY),
        )
        assertEquals(
            json("[$expected]"),
            TokenParameterRestore.restore(before, json("[$after]"), setOf("/value/name"), TokenType.FONT_FAMILY),
        )
        assertEquals(
            JsonPrimitive("[$expected]"),
            TokenParameterRestore.restore(
                before,
                JsonPrimitive("[$after]"),
                setOf("/value/name"),
                TokenType.FONT_FAMILY,
            ),
        )
    }

    @Test
    fun `restores a shadow component in its original platform string`() {
        val before = json("""["0rem 1rem 2rem 0rem #00000066"]""")
        val after = json("""["0rem 1rem 3rem 0rem #ffffff66"]""")
        assertEquals(
            json("""["0rem 1rem 2rem 0rem #ffffff66"]"""),
            TokenParameterRestore.restore(before, after, setOf("/value/0/blur"), TokenType.SHADOW),
        )
    }

    @Test
    fun `rejects unchanged unknown and technical paths`() {
        val before = json("""{"fontSize":14,"lineHeight":20}""")
        val after = json("""{"fontSize":16,"lineHeight":20}""")
        listOf("/value/lineHeight", "/tenant_id", "/value/missing", "/value").forEach { path ->
            assertNull(TokenParameterRestore.restore(before, after, setOf(path), TokenType.TYPOGRAPHY))
        }
    }

    @Test
    fun `does not partially patch inserted or reordered layers`() {
        val before = json("""["red","blue"]""")
        listOf("""["red","green","blue"]""", """["blue","red"]""").forEach { raw ->
            val after = json(raw)
            assertNull(TokenParameterRestore.restore(before, after, setOf("/value/0"), TokenType.GRADIENT))
            assertEquals(before, TokenParameterRestore.restore(before, after, setOf("/value"), TokenType.GRADIENT))
        }
    }

    @Test
    fun `restores missing object properties without touching their neighbours`() {
        val before = json("""{"fontSize":14}""")
        val after = json("""{"fontSize":16,"fontWeight":500}""")
        assertEquals(
            json("""{"fontSize":16}"""),
            TokenParameterRestore.restore(before, after, setOf("/value/fontWeight"), TokenType.TYPOGRAPHY),
        )
    }

    @Test
    fun `preserves JSON encoded legacy values and escaped property names`() {
        val before = JsonPrimitive("""{"a/b~c":14,"lineHeight":20}""")
        val after = JsonPrimitive("""{"a/b~c":16,"lineHeight":24}""")
        assertEquals(
            JsonPrimitive("""{"a/b~c":14,"lineHeight":24}"""),
            TokenParameterRestore.restore(before, after, setOf("/value/a~1b~0c"), TokenType.TYPOGRAPHY),
        )
    }
}
