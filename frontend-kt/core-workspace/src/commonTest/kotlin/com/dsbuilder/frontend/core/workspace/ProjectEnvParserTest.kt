package com.dsbuilder.frontend.core.workspace

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

class ProjectEnvParserTest {
    @Test
    fun parsesSupportedAssignmentsWithoutExpansion() {
        val values = ProjectEnvParser().parse(
            """
            # comment
            export KEY='first'
            KEY="second" # trailing comment
            URL=https://example.test # comment
            LITERAL=${'$'}(echo secret)
            """.trimIndent(),
        )

        assertEquals("second", values["KEY"])
        assertEquals("https://example.test", values["URL"])
        assertEquals("${'$'}(echo secret)", values["LITERAL"])
    }

    @Test
    fun errorsNeverIncludeSecretText() {
        val error = assertFailsWith<ProjectEnvParseException> {
            ProjectEnvParser().parse("GOOD=value\nBAD-NAME=very-secret")
        }
        assertEquals(2, error.lineNumber)
        assertFalse(error.message.orEmpty().contains("very-secret"))
    }
}
