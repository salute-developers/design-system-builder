package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.palette.PaletteGoldenTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

/** Форма значений `token-values` для потребителей: раскрытие ссылок и форма по типу токена. */
class TokenValuePublisherTest {
    private val tenant = UUID.randomUUID()

    @Test
    fun `form by type applies without a palette snapshot`() {
        val publisher = TokenValuePublisher(tenant, null)
        val solid = value("ios", """["#123456"]""", ThemeTokenType.GRADIENT)
        val published = publisher.publish(listOf(solid)).single()
        assertEquals("""[{"kind":"color","background":"#123456"}]""", published.valueJson)
        assertEquals("""["#123456"]""", published.sourceValueJson)

        // Ссылку без палитры раскрыть нечем: она остаётся в слое, `paletteRef` не отдаётся.
        val referenced = publisher.publish(listOf(value("ios", """["[general.red.500]"]""", ThemeTokenType.GRADIENT)))
            .single()
        assertEquals("""[{"kind":"color","background":"[general.red.500]"}]""", referenced.valueJson)
        assertNull(referenced.paletteRef)

        val color = value("web", """["[general.red.500]"]""", ThemeTokenType.COLOR)
        assertSame(color, publisher.publish(listOf(color)).single(), "форма не меняется — значение как есть")
    }

    @Test
    fun `whole value reference is returned in paletteRef without sourceValue`() {
        val golden = PaletteGoldenTest()
        val tokenId = UUID.randomUUID()
        val tokens = golden.scenarioTokens().let { listOf(it.first().copy(id = tokenId.toString())) + it.drop(1) }
        val snapshot = TenantPaletteSnapshot(golden.scenarioState(), tokens, golden.scenarioValues())
        val (ramp, steps) = snapshot.state.template.entries.first()
        val reference = "[${ramp.key}.${steps.keys.first()}]"
        val stored = value("ios", """["$reference"]""", ThemeTokenType.GRADIENT, tokenId)

        val published = TokenValuePublisher(tenant, snapshot).publish(listOf(stored)).single()

        assertEquals(reference, published.paletteRef)
        assertNull(published.sourceValueJson)
        val layer = Json.parseToJsonElement(requireNotNull(published.valueJson)).jsonArray.single().jsonObject
        assertEquals("color", layer.getValue("kind").jsonPrimitive.content)
        assertTrue(layer.getValue("background").jsonPrimitive.content.startsWith("#"), layer.toString())
    }

    private fun value(platform: String, json: String, type: ThemeTokenType, tokenId: UUID = UUID.randomUUID()) =
        TenantTokenValue(
            id = UUID.randomUUID(),
            tokenId = tokenId,
            tenantId = tenant,
            paletteId = null,
            platform = platform,
            mode = "light",
            valueJson = json,
            editRevision = 0,
            createdAt = Instant.EPOCH,
            updatedAt = Instant.EPOCH,
            tokenType = type,
        )
}
