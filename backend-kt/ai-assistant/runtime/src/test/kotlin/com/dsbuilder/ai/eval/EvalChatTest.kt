package com.dsbuilder.ai.eval

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals

class EvalChatTest {
    private fun result(tool: String, isError: Boolean = false) =
        "tool_result" to Json.parseToJsonElement("""{"tool":"$tool","isError":$isError}""").jsonObject

    private fun expect(json: String): JsonObject = Json.parseToJsonElement(json).jsonObject

    @Test
    fun readOnlyTurnPassesAScenarioWithoutWrites() {
        val events = listOf(result("components_list"), result("component_editor_get"))
        val outcome = TurnOutcome(successfulWrites(events), null, null, 5, 5)

        assertEquals(emptyList(), problems(expect("""{"journalGrows":false}"""), outcome))
    }

    @Test
    fun readThenConfirmationIsNotAWrite() {
        val events = listOf(result("component_editor_get"))
        val outcome = TurnOutcome(successfulWrites(events), "component_property_reset", null, 5, 5)

        val expected = """{"journalGrows":false,"confirmation":true,"confirmationTool":"component_property_reset"}"""
        assertEquals(emptyList(), problems(expect(expected), outcome))
    }

    @Test
    fun onlySuccessfulWriteToolsCount() {
        val events = listOf(
            result("tokens_list"),
            result("component_property_set"),
            result("size_token_value_update", isError = true),
        )
        assertEquals(listOf("component_property_set"), successfulWrites(events))
    }
}
