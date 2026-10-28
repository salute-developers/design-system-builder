package com.dsbuilder.ds.themes.domain.palette

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** Слои теней со ссылками на ступени дают связи растяжек, но не входят в принадлежность цветовых токенов. */
class ThemePaletteLayerLinksTest {
    private val gray = PaletteRampRef(ThemePaletteType.GENERAL, "gray")
    private val state = TenantPaletteState(
        editRevision = 0,
        template = mapOf(gray to mapOf(900 to "#101010")),
        groups = SystemPaletteGroup.entries.map { key ->
            StoredPaletteGroup("group-${key.name.lowercase()}", PaletteGroupKind.SYSTEM, key, key.name)
        },
        ramps = emptyList(),
        tokenGroups = emptyMap(),
    )
    private val shadow = PaletteTokenRef("shadow-1", "down.hard.m", "downHardM")
    private val layer = PaletteTokenValue(
        tokenId = shadow.id,
        mode = null,
        platform = "web",
        reference = PaletteReference(gray, 900, 0.16),
        valueId = "value-1",
    )

    @Test
    fun `тень связана с растяжкой своей группы по правилу имени`() {
        val palette = ThemePaletteBuilder.build(
            "tenant",
            true,
            state,
            emptyList(),
            emptyList(),
            listOf(shadow),
            listOf(layer),
        )

        val link = palette.links.single()
        assertEquals("shadow-1", link.tokenId)
        assertEquals(state.systemGroupId(SystemPaletteGroup.NEUTRAL), link.groupId)
        assertTrue(palette.tokens.isEmpty())
        val ramp = requireNotNull(palette.ramp(link.groupId, gray))
        assertEquals(1, ramp.linkedCount)
        assertEquals("#10101029", ThemePaletteResolver.resolve(palette, shadow.name, layer.reference!!))
    }

    @Test
    fun `удаление растяжки переписывает ссылки слоя тени`() {
        val palette = ThemePaletteBuilder.build(
            "tenant",
            true,
            state,
            emptyList(),
            emptyList(),
            listOf(shadow),
            listOf(layer),
        )
        val neutral = state.systemGroupId(SystemPaletteGroup.NEUTRAL)

        val removed = PaletteOperations.removeRamp(state, neutral, gray, RemoveRampStrategy.DETACH, null, palette)

        val rewrite = requireNotNull(assertIs<PaletteOperationResult.Applied<RemovedRamp>>(removed).value.rewrite)
        assertEquals(listOf("shadow-1"), rewrite.tokenIds)
        assertEquals("#10101029", rewrite.rewrite(layer.reference!!) { "#101010" })
    }
}
