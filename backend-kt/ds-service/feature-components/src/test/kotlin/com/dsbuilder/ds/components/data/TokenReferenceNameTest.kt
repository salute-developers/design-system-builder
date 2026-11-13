package com.dsbuilder.ds.components.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Имя ссылки по `token_id` в выгрузке: у типографии — стиль без экрана, как текстовая ссылка. */
class TokenReferenceNameTest {
    @Test
    fun `ссылка на токен типографии выгружается без экрана, остальные — по имени`() {
        assertEquals("body.m.normal", referenceName("screen-s.body.m.normal", "typography"))
        assertEquals("down.hard.m", referenceName("down.hard.m", "shadow"))
        assertEquals("screen-s.body.m.normal", referenceName("screen-s.body.m.normal", null))
        assertNull(referenceName(null, "typography"))
    }

    @Test
    fun `импорт ищет стиль типографии без экрана и в screen-s, остальные ссылки — по имени`() {
        assertEquals(
            listOf("body.m.normal", "screen-s.body.m.normal"),
            referenceCandidates("body.m.normal", "typography"),
        )
        assertEquals(listOf("screen-l.body.m.normal"), referenceCandidates("screen-l.body.m.normal", "typography"))
        assertEquals(listOf("down.hard.m"), referenceCandidates("down.hard.m", "shadow"))
        assertEquals(listOf("body.m.normal"), referenceCandidates("body.m.normal", "color"))
    }

    @Test
    fun `литералы CSS не считаются именами токенов`() {
        listOf("transparent", "inherit", "#F3A912", "rgba(35, 35, 35, 0.2)", "rgb(0,0,0)").forEach {
            assertTrue(isLiteralValue(it), it)
        }
        listOf("surface.default.accent", "body.l.bold", "screen-s.body.l.bold", "general.red.300").forEach {
            assertFalse(isLiteralValue(it), it)
        }
    }
}
