package com.dsbuilder.frontend.plugin.androidstudio.preview

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class PayloadAssemblerTest {
    private fun fixtures(): List<JsonObject> =
        (
            ApiJson.parseToJsonElement(
                requireNotNull(javaClass.getResource("/preview/assembler-golden.json")).readText(),
            ) as JsonArray
            )
            .map { it as JsonObject }

    @Test
    fun matchesWebAssemblerOnSharedCanonicalFixtures() {
        fixtures().forEach { pair ->
            val result =
                assertIs<AssemblyResult.Success>(PayloadAssembler.assemble(ComponentPreviewDraft(pair.obj("draft"))))
            assertEquals(pair["payload"], result.payload, pair.text("name"))
        }
    }

    @Test
    fun reportsMissingTokenWithItsPath() {
        val draft = fixtures().first().obj("draft")
        val invalid = JsonObject(draft + ("themeTokens" to JsonArray(emptyList())))
        val failure = assertIs<AssemblyResult.Failed>(PayloadAssembler.assemble(ComponentPreviewDraft(invalid)))
        assertEquals("missing_token", failure.diagnostic.code)
        assertEquals("typography.button", failure.diagnostic.path)
    }

    @Test
    fun rejectsOutOfRangeAlpha() {
        val draft = fixtures().first().obj("draft")
        val properties = draft.objects("invariantProperties").toMutableList()
        properties[0] = JsonObject(properties[0] + ("alpha" to JsonPrimitive(2)))
        val failure = assertIs<AssemblyResult.Failed>(
            PayloadAssembler.assemble(
                ComponentPreviewDraft(
                    JsonObject(draft + ("invariantProperties" to JsonArray(properties))),
                ),
            ),
        )
        assertEquals("incompatible_value", failure.diagnostic.code)
    }
}
