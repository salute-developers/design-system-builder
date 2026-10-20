package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.Json
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Формат чтения: px веба, свои значения платформ, расхождение без признака и вычисляемые радиусы. */
class SizeTokenViewsTest {
    private val id = UUID.randomUUID()

    @Test
    fun `расхождение платформ без признака отмечается`() {
        val values = radius("2rem", 40, 40, overridden = false)
        val view = SizeTokenViews.dimension(id, "round.xxl", SizeTokenKind.RADIUS, values, emptyList(), emptyList())

        assertEquals(32, view.valuePx)
        assertEquals(emptyMap(), view.platforms)
        assertEquals(mapOf(NativePlatform.IOS to 40, NativePlatform.ANDROID to 40), view.native)
        assertTrue(view.platformsDiffer)
    }

    @Test
    fun `свои значения платформ не считаются расхождением`() {
        val values = radius("2rem", 40, 40, overridden = true)
        val view = SizeTokenViews.dimension(id, "round.xxl", SizeTokenKind.RADIUS, values, emptyList(), emptyList())

        assertEquals(mapOf(NativePlatform.IOS to 40, NativePlatform.ANDROID to 40), view.platforms)
        assertFalse(view.platformsDiffer)
    }

    @Test
    fun `полное скругление не имеет значения`() {
        val values = radius("100rem", 0, 0, overridden = false)
        val view = SizeTokenViews.dimension(id, "round.circle", SizeTokenKind.RADIUS, values, emptyList(), emptyList())

        assertTrue(view.fullRounding)
        assertNull(view.valuePx)
        assertFalse(view.platformsDiffer)
        assertEquals(emptyList(), view.derived)
    }

    @Test
    fun `вычисляемые радиусы группируются по смещению`() {
        val button = AdjustedUsage("Button", "web", "buttonRadius")
        val iconButton = AdjustedUsage("IconButton", "web", "iconButtonRadius")
        val offsets = listOf(
            RadiusOffset(-2, iconButton),
            RadiusOffset(-2, button),
            RadiusOffset(-2, button),
            RadiusOffset(0, button),
            RadiusOffset(-20, AdjustedUsage("Chip", "web", null)),
        )
        val values = radius("1rem", 16, 16, overridden = false)
        val view = SizeTokenViews.dimension(id, "round.l", SizeTokenKind.RADIUS, values, emptyList(), offsets)

        assertEquals(
            listOf(
                DerivedRadius(-20, 0, listOf(AdjustedUsage("Chip", "web", null))),
                DerivedRadius(-2, 14, listOf(button, iconButton)),
            ),
            view.derived,
        )
        val spacing = SizeTokenViews.dimension(id, "spacing.8x", SizeTokenKind.SPACING, values, emptyList(), offsets)
        assertEquals(emptyList(), spacing.derived)
    }

    @Test
    fun `тень читается из веба, запасная высота из Android`() {
        val layers = listOf(ShadowLayer(0, 4, 14, -4, "#08080814"), ShadowLayer(0, 1, 4, -1, "#0000000A"))
        val written = SizePlatformValues.write(SizeTokenKind.SHADOW, SizeTokenValue.Shadow(layers, 2))
            .associate { it.platform to SizeStoredValue(it.value, it.overridden) }
        val components = listOf(ComponentUsage("TextField", 1), ComponentUsage("Popover", 2))
        val view = SizeTokenViews.shadow(id, "down.soft.s", written, components)

        assertEquals(layers, view.layers)
        assertEquals(2, view.fallbackElevation)
        assertEquals(emptyMap(), view.platforms)
        assertEquals(layers, view.native[NativePlatform.IOS])
        assertFalse(view.platformsDiffer)
        assertEquals(listOf("Popover", "TextField"), view.components.map(ComponentUsage::name))

        val changedIos = written + (ThemeTokenPlatform.IOS to SizeStoredValue(Json.parseToJsonElement("[]"), false))
        assertTrue(SizeTokenViews.shadow(id, "down.soft.s", changedIos, emptyList()).platformsDiffer)
    }

    private fun radius(web: String, ios: Int, android: Int, overridden: Boolean) = mapOf(
        ThemeTokenPlatform.WEB to stored("""["$web"]""", false),
        ThemeTokenPlatform.IOS to stored("""[{"kind":"round","cornerRadius":$ios}]""", overridden),
        ThemeTokenPlatform.ANDROID to stored("""[{"kind":"round","cornerRadius":$android}]""", overridden),
    )

    private fun stored(json: String, overridden: Boolean) = SizeStoredValue(Json.parseToJsonElement(json), overridden)
}
