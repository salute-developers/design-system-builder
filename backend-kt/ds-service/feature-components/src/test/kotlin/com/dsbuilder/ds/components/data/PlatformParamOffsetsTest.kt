package com.dsbuilder.ds.components.data

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Правила выбора смещения из поправок платформенных параметров. */
class PlatformParamOffsetsTest {
    private val row = UUID.fromString("2df66b98-13b7-46d9-b611-43459e4f4367")

    @Test
    fun `accepts decimal numbers only`() {
        listOf("2", "-2", "+2", "0.5", ".5", "5.", "1e3", "-1.5E-2").forEach {
            assertTrue(PlatformParamOffsets.isNumeric(it), it)
        }
        listOf("", " ", "abc", "round.l", "2px", "0x10", "NaN", "Infinity", "1f", " 2").forEach {
            assertFalse(PlatformParamOffsets.isNumeric(it), "'$it'")
        }
    }

    @Test
    fun `prefers web then xml compose and ios`() {
        val picked = PlatformParamOffsets.pick(
            listOf(candidate("ios", "4"), candidate("compose", "3"), candidate("xml", "2"), candidate("web", "1")),
        )

        assertEquals(mapOf(row to "1"), picked)
        assertEquals(
            mapOf(row to "3"),
            PlatformParamOffsets.pick(listOf(candidate("ios", "4"), candidate("compose", "3"))),
        )
    }

    @Test
    fun `ignores non numeric adjustments and copies of the row value`() {
        val picked = PlatformParamOffsets.pick(
            listOf(candidate("web", "sd_shape"), candidate("xml", "8", rowValue = "8"), candidate("ios", "")),
        )

        assertEquals(emptyMap(), picked)
    }

    @Test
    fun `falls back to a lower priority platform when the preferred one is not an offset`() {
        val picked = PlatformParamOffsets.pick(listOf(candidate("web", "8", rowValue = "8"), candidate("xml", "-2")))

        assertEquals(mapOf(row to "-2"), picked)
    }

    private fun candidate(platform: String, offset: String, rowValue: String? = "round.l") =
        PlatformParamOffsets.Candidate(row, rowValue, platform, offset)
}
