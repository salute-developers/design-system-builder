package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.LiteralValueBatchContext
import com.dsbuilder.ds.core.application.LiteralValueBatchValue
import kotlinx.serialization.json.Json
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Литерал не освобождает пакет от проверки родителей и ссылок на палитру. */
class LiteralValueBatchValidationTest {
    @Test
    fun `palette rule checks every parent and restored reference from the batch context`() {
        val value = LiteralValueBatchValue(
            entityType = "token-value",
            entityId = UUID.randomUUID(),
            tokenId = UUID.randomUUID(),
            tenantId = UUID.randomUUID(),
            tokenType = "color",
            parentsVisible = true,
            creationBaseline = false,
            previousPaletteId = null,
            previousValue = Json.parseToJsonElement("[\"#FFFFFF\"]"),
        )
        val context = LiteralValueBatchContext(UUID.randomUUID(), UUID.randomUUID(), listOf(value), emptyList())
        val rule = PaletteRevertDependencyValidator()
        assertTrue(rule.validLiteralBatch(context))
        for (invalid in listOf(
            value.copy(parentsVisible = false),
            value.copy(previousPaletteId = UUID.randomUUID()),
            value.copy(previousValue = Json.parseToJsonElement("[\"[general.blue.500]\"]")),
        )) {
            assertFalse(rule.validLiteralBatch(context.copy(values = listOf(value, invalid))))
        }
    }
}
