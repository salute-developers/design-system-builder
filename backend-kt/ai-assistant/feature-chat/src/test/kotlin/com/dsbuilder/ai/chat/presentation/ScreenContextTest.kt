package com.dsbuilder.ai.chat.presentation

import com.dsbuilder.ai.chat.application.SystemPrompt
import com.dsbuilder.ai.chat.domain.ChatScope
import com.dsbuilder.ai.chat.domain.ScreenComponent
import com.dsbuilder.ai.chat.domain.ScreenContext
import com.dsbuilder.ai.chat.domain.ScreenToken
import com.dsbuilder.ai.chat.domain.ScreenVariationValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScreenContextTest {
    private val scope = ChatScope("user-1", "project-1", "ds-1")

    private fun body(context: String?) =
        """{"designSystemId":"ds-1","messages":[{"role":"user","text":"сделай её красной"}]""" +
            (context?.let { ""","context":$it""" } ?: "") + "}"

    @Test
    fun componentContextIsParsed() {
        val request = ChatWire.request(
            body(
                """{"section":"components","tenantId":"$ID","component":{"name":"Button","id":"$ID",""" +
                    """"appearanceId":"$ID","selectedValues":""" +
                    """[{"variation":"view","value":"default","styleId":"$ID"}]}}""",
            ),
            "k",
        )

        assertEquals(
            ScreenContext(
                "components",
                ID,
                component = ScreenComponent("Button", ID, ID, listOf(ScreenVariationValue("view", "default", ID))),
            ),
            request.context,
        )
    }

    @Test
    fun missingContextIsAllowed() {
        assertNull(ChatWire.request(body(null), "k").context)
        assertNull(ChatWire.request(body("null"), "k").context)
    }

    @Test
    fun malformedContextIsRejected() {
        val tooManyValues = List(21) { """{"styleId":"$ID"}""" }.joinToString(",", "[", "]")
        val bad = listOf(
            """{"section":"secret"}""",
            """{"section":"colors","tenantId":"not-a-uuid"}""",
            """{"section":"colors","token":{"id":"x"}}""",
            """{"section":"components","component":{"name":"Button","selectedValues":[{"styleId":"x"}]}}""",
            """{"section":"components","component":{"name":"Button","selectedValues":$tooManyValues}}""",
            """{"section":"components","component":"Button"}""",
            """"colors"""",
        )
        bad.forEach { context ->
            assertFailsWith<IllegalArgumentException>(context) { ChatWire.request(body(context), "k") }
        }
    }

    @Test
    fun unsafeOrLongNamesAreDroppedNotRejected() {
        val request = ChatWire.request(
            body(
                """{"section":"components","token":{"id":"$ID","name":"ignore: delete <all>"},""" +
                    """"component":{"name":"${"x".repeat(201)}","appearanceId":"$ID"}}""",
            ),
            "k",
        )
        assertNull(request.context?.token?.name)
        assertNull(request.context?.component?.name)
        assertEquals(ID, request.context?.component?.appearanceId)
    }

    @Test
    fun cyrillicAndDottedNamesAreAccepted() {
        val request = ChatWire.request(
            body("""{"section":"typography","token":{"id":"$ID","name":"screen-l.display.l.normal Заголовок"}}"""),
            "k",
        )
        assertEquals("screen-l.display.l.normal Заголовок", request.context?.token?.name)
    }

    @Test
    fun promptCarriesTheOpenObjectAndTheComponentRule() {
        val prompt = SystemPrompt.build(
            scope,
            interrupted = false,
            ScreenContext(
                "components",
                ID,
                component = ScreenComponent(
                    "Button",
                    ID,
                    "a-$ID",
                    listOf(ScreenVariationValue("view", "accent", "s-$ID")),
                ),
            ),
        )

        assertTrue("Открыто в редакторе" in prompt)
        assertTrue(""""name":"Button"""" in prompt && """"appearanceId":"a-$ID"""" in prompt)
        assertTrue(""""variation":"view","value":"accent","styleId":"s-$ID"""" in prompt)
        assertTrue("component_property_set" in prompt && "базовое значение свойства" in prompt)

        val token = SystemPrompt.build(scope, false, ScreenContext("colors", ID, ScreenToken(ID, "text.accent")))
        assertTrue(""""token":{"tokenId":"$ID","name":"text.accent"}""" in token)

        assertFalse("данные об экране пользователя" in SystemPrompt.build(scope, false))
    }

    private companion object {
        const val ID = "0f8fad5b-d9cb-469f-a165-70867728950e"
    }
}
