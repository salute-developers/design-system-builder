package com.dsbuilder.ds.components.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** Имя ссылки по `token_id` в выгрузке: у типографии — стиль без экрана, как текстовая ссылка. */
class TokenReferenceNameTest {
    @Test
    fun `ссылка на токен типографии выгружается без экрана, остальные — по имени`() {
        assertEquals("body.m.normal", referenceName("screen-s.body.m.normal", "typography"))
        assertEquals("down.hard.m", referenceName("down.hard.m", "shadow"))
        assertEquals("screen-s.body.m.normal", referenceName("screen-s.body.m.normal", null))
        assertNull(referenceName(null, "typography"))
    }
}
