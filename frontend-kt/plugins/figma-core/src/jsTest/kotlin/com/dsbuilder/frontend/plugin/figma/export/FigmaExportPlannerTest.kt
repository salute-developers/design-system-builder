package com.dsbuilder.frontend.plugin.figma.export

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FigmaExportPlannerTest {
    private val source = Json.parseToJsonElement(
        """
        {
          "groups": [
            {"id": "g-text", "parentId": null, "label": "Text & Icons"},
            {"id": "g-text-general", "parentId": "g-text", "label": "General"},
            {"id": "g-surface", "parentId": null, "label": "Surfaces"},
            {"id": "g-surface-accent-t", "parentId": "g-surface", "label": "Accent / Transparent"},
            {"id": "g-surface-general-s", "parentId": "g-surface", "label": "General / Solid"},
            {"id": "g-bg", "parentId": null, "label": "BG"},
            {"id": "g-bg-default", "parentId": "g-bg", "label": "Default"}
          ],
          "tokens": [
            {"id": "t1", "name": "text.default.primary", "type": "color", "enabled": true, "groupId": "g-text-general"},
            {"id": "t2", "name": "text.on-dark.primary", "type": "color", "enabled": true, "groupId": "g-text-general"},
            {"id": "t3", "name": "text.default.primary-hover", "type": "color", "enabled": true,
             "groupId": "g-text-general"},
            {"id": "t4", "name": "text.default.off", "type": "color", "enabled": false, "groupId": "g-text-general"},
            {"id": "t5", "name": "surface.on-dark.transparent-accent", "type": "color", "enabled": true,
             "groupId": "g-surface-accent-t"},
            {"id": "t6", "name": "surface.default.solid-card", "type": "gradient", "enabled": true,
             "groupId": "g-surface-general-s"},
            {"id": "t7", "name": "background.default.primary", "type": "color", "enabled": true,
             "groupId": "g-bg-default"},
            {"id": "t8", "name": "background.dark.primary", "type": "color", "enabled": true,
             "groupId": "g-bg-default"},
            {"id": "t9", "name": "surface.default.accent-gradient", "type": "gradient", "enabled": true,
             "groupId": "g-surface-accent-t"},
            {"id": "t10", "name": "orphan", "type": "color", "enabled": true, "groupId": "g-text-general"}
          ],
          "values": [
            {"tokenId": "t1", "platform": "web", "mode": "light", "value": ["#080808"],
             "paletteRef": "[general.gray.950]"},
            {"tokenId": "t1", "platform": "web", "mode": "dark", "value": ["#F5F5F5"]},
            {"tokenId": "t1", "platform": "ios", "mode": "dark", "value": "#000000"},
            {"tokenId": "t2", "platform": "web", "mode": "light", "value": ["#F5F5F5"]},
            {"tokenId": "t3", "platform": "web", "mode": "light", "value": ["#101010"]},
            {"tokenId": "t3", "platform": "web", "mode": "dark", "value": ["#E0E0E0"]},
            {"tokenId": "t2", "platform": "web", "mode": "dark", "value": ["#F5F5F5"]},
            {"tokenId": "t5", "platform": "web", "mode": "light", "value": ["#08080829"],
             "paletteRef": "[general.gray.900][0.16]"},
            {"tokenId": "t5", "platform": "web", "mode": "dark", "value": ["#F5F5F593"]},
            {"tokenId": "t6", "platform": "web", "mode": "light", "value": ["#FFFFFF"]},
            {"tokenId": "t6", "platform": "web", "mode": "dark", "value": ["#202020"]},
            {"tokenId": "t7", "platform": "web", "mode": "light", "value": ["#FFFFFF"]},
            {"tokenId": "t7", "platform": "web", "mode": "dark", "value": ["#000000"]},
            {"tokenId": "t8", "platform": "web", "mode": "light", "value": ["#111111"]},
            {"tokenId": "t8", "platform": "web", "mode": "dark", "value": ["#111111"]},
            {"tokenId": "t9", "platform": "web", "mode": "light", "value": ["#1A9E32"]},
            {"tokenId": "t9", "platform": "web", "mode": "dark",
             "value": ["#FFFFFF80", "linear-gradient(45deg, #1A9E32FF 0%, #04C6C9FF 100%)"]},
            {"tokenId": "t10", "platform": "web", "mode": "light", "value": ["#111111"]}
          ],
          "palette": {
            "groups": [
              {"id": "p-neutral", "label": "Neutral", "ramps": [
                {"slot": {"type": "general", "shade": "gray"}, "displayName": "Gray",
                 "steps": [{"step": 900, "value": "#0E1015"}, {"step": 950, "value": "#080808"}]}
              ]},
              {"id": "p-accent", "label": "Accent", "ramps": [
                {"slot": {"type": "general", "shade": "gray"}, "displayName": "Gray",
                 "steps": [{"step": 900, "value": "#101010"}]}
              ]}
            ],
            "tokens": [
              {"tokenId": "t1", "groupId": "p-neutral"},
              {"tokenId": "t5", "groupId": "p-neutral"}
            ]
          },
          "typography": {
            "families": [{"name": "header", "fontName": "SB Sans Display"}],
            "screens": [
              {"screen": "screen-l", "styles": [{"group": "header", "size": "h1", "sizePx": 48, "lineHeightPx": 52,
                "letterSpacingEm": -0.02, "fontFamily": "header",
                "variants": {"bold": {"tokenId": "ty-l", "weight": 600}}}]},
              {"screen": "screen-s", "styles": [{"group": "header", "size": "h1", "sizePx": 32, "lineHeightPx": 36,
                "letterSpacingEm": 0, "fontFamily": "header",
                "variants": {"bold": {"tokenId": "ty-s", "weight": 600}}}]}
            ]
          },
          "sizes": {
            "radii": [
              {"tokenId": "r1", "name": "round.m", "valuePx": 12, "fullRounding": false},
              {"tokenId": "r2", "name": "round.circle", "valuePx": null, "fullRounding": true},
              {"tokenId": "r0", "name": "round.none", "valuePx": 0, "fullRounding": false}
            ],
            "spacing": [{"tokenId": "s1", "name": "spacing.4x", "valuePx": 8}],
            "shadows": [{"tokenId": "sh1", "name": "down.soft.s", "layers": [
              {"offsetX": 0, "offsetY": 4, "blur": 14, "spread": -4, "color": "#08080814"},
              {"offsetX": 0, "offsetY": 1, "blur": 4, "spread": -1, "color": "#0000000A"}
            ]}]
          }
        }
        """.trimIndent(),
    ).jsonObject

    private val plan = FigmaExportPlanner.plan(source, ExportThemeInfo("Malachite", "tenant", "v1"))

    private fun collection(name: String) = plan.collections.single { it.name == name }

    private fun variable(collection: String, name: String) =
        collection(collection).variables.singleOrNull { it.name == name }

    @Test
    fun collectionsAndModesFollowTheSample() {
        assertEquals(
            listOf("00. Palette", "01. Theme", "02. SubTheme", "03. Typography", "04. Numbers", "05. Spacing"),
            plan.collections.map { it.name },
        )
        assertEquals(listOf("Light", "Dark"), collection("01. Theme").modes.map { it.name })
        assertEquals(
            listOf("Default", "onDark", "onLight", "Inverse"),
            collection("02. SubTheme").modes.map { it.name },
        )
        assertEquals(listOf("Large", "Medium", "Small"), collection("03. Typography").modes.map { it.name })
        assertEquals(listOf("Default"), collection("04. Numbers").modes.map { it.name })
    }

    @Test
    fun themeNamesComeFromTokenGroups() {
        assertNotNull(variable("01. Theme", "Text&Icons/Default/General/Primary"))
        assertNotNull(variable("01. Theme", "Text&Icons/onDark/General/Primary"))
        assertNotNull(variable("01. Theme", "Surfaces/onDark/Accent/Transparent/Accent"))
        assertNotNull(variable("01. Theme", "Surfaces/Default/General/Solid/Card"))
        assertNotNull(variable("01. Theme", "BG/Primary"))
        assertNotNull(variable("01. Theme", "BG/onDark/Primary"))
    }

    @Test
    fun statesAreExportedNextToTheBaseColorAndDisabledTokensAreOmitted() {
        assertNotNull(variable("01. Theme", "Text&Icons/Default/General/PrimaryHover"))
        val hover = variable("02. SubTheme", "Text&Icons/General/PrimaryHover")!!
        assertEquals(PlanValue.Alias("theme:t3"), hover.values["default"])
        assertEquals(PlanValue.Alias("theme:t3"), hover.values["on-dark"])
        assertEquals(1, plan.omittedDisabled)
        assertTrue(collection("01. Theme").variables.none { it.name.contains("Off") })
        assertEquals("orphan", plan.skipped.single().name)
    }

    @Test
    fun paletteReferenceBecomesAliasOfTheTokenPaletteGroup() {
        assertNotNull(variable("00. Palette", "Neutral/Gray/900"))
        assertNotNull(variable("00. Palette", "Accent/Gray/900"))
        val primary = variable("01. Theme", "Text&Icons/Default/General/Primary")!!
        assertEquals(PlanValue.Alias("palette:p-neutral:general.gray.950"), primary.values["light"])
        assertEquals(PlanValue.Color(PlanColor(245 / 255.0, 245 / 255.0, 245 / 255.0, 1.0)), primary.values["dark"])
        val accent = variable("01. Theme", "Surfaces/onDark/Accent/Transparent/Accent")!!
        assertEquals(PlanValue.Alias("palette:p-neutral:general.gray.900", 16.0), accent.values["light"])
        assertEquals(0x93 / 255.0, (accent.values["dark"] as PlanValue.Color).color.a)
        assertTrue(primary.scopes.isEmpty())
    }

    @Test
    fun subThemeAliasesThemeOfItsContextOrDefault() {
        val primary = variable("02. SubTheme", "Text&Icons/General/Primary")!!
        assertEquals(PlanValue.Alias("theme:t1"), primary.values["default"])
        assertEquals(PlanValue.Alias("theme:t2"), primary.values["on-dark"])
        assertEquals(PlanValue.Alias("theme:t1"), primary.values["on-light"])
        assertEquals("subtheme:t1", primary.key)
        val background = variable("02. SubTheme", "BG/Primary")!!
        assertEquals(PlanValue.Alias("theme:t8"), background.values["on-dark"])
        assertEquals(listOf("ALL_SCOPES"), background.scopes)
    }

    @Test
    fun solidGradientTokenIsVariableAndGradientWithDifferentLayersIsStylePair() {
        assertNotNull(variable("01. Theme", "Surfaces/Default/General/Solid/Card"))
        assertNull(variable("01. Theme", "Surfaces/Default/Accent/Transparent/AccentGradient"))
        val dark = plan.paintStyles.single { it.name == "Dark/Surfaces/Default/Accent/Transparent/AccentGradient" }
        assertEquals(2, dark.paints.size)
        val linear = dark.paints[1] as PlanPaint.Linear
        assertEquals(45.0, linear.angle)
        assertEquals(listOf(0.0, 1.0), linear.stops.map { it.first })
        val light = plan.paintStyles.single { it.name == "Light/Surfaces/Default/Accent/Transparent/AccentGradient" }
        assertTrue(light.paints.single() is PlanPaint.Solid)
        assertTrue(plan.skipped.none { it.name == "surface.default.accent-gradient" })
        val reason = plan.notes.single { it.name == "surface.default.accent-gradient" }.reason
        assertEquals("градиент описан парой стилей Light и Dark: в режимах разное число слоёв", reason)
        assertTrue(collection("01. Theme").variables.none { it.name.startsWith("GradientStops/") })
    }

    @Test
    fun typographyVariablesPerScreenAndBoundTextStyle() {
        val size = variable("03. Typography", "Header/H1 B/Font Size")!!
        assertEquals(PlanValue.Number(48.0), size.values["screen-l"])
        assertEquals(PlanValue.Number(32.0), size.values["screen-s"])
        assertEquals(listOf("FONT_SIZE"), size.scopes)
        val spacing = variable("03. Typography", "Header/H1 B/Letter Spacing")!!
        assertEquals(PlanValue.Number(-0.96), spacing.values["screen-l"])
        val family = variable("03. Typography", "FontFamily/Header")!!
        assertEquals(PlanValue.Text("SB Sans Display"), family.values["screen-s"])
        val style = plan.textStyles.single()
        assertEquals("Header/H1 B", style.name)
        assertEquals("typography:header.h1.bold:size", style.bindings["fontSize"])
        assertEquals("font-family:header", style.bindings["fontFamily"])
        assertEquals(600, style.fontWeight)
    }

    @Test
    fun sizesAndShadows() {
        assertEquals(PlanValue.Number(12.0), variable("04. Numbers", "CornerRadius/cRm")!!.values["default"])
        assertEquals(PlanValue.Number(1000.0), variable("04. Numbers", "CornerRadius/Rounded")!!.values["default"])
        assertEquals(PlanValue.Number(10.0), variable("04. Numbers", "CornerRadius/calc:[cRm-2]")!!.values["default"])
        assertEquals(
            listOf("CornerRadius/cRm", "CornerRadius/calc:[cRm-2]", "CornerRadius/Rounded", "CornerRadius/null"),
            collection("04. Numbers").variables.map { it.name },
        )
        assertEquals(PlanValue.Number(0.0), variable("04. Numbers", "CornerRadius/null")!!.values["default"])
        assertEquals(listOf("GAP"), variable("05. Spacing", "Spacing/4x")!!.scopes)
        val shadow = plan.effectStyles.single()
        assertEquals("Shadows/Down/Soft/S", shadow.name)
        assertEquals(listOf(-4.0, -1.0), shadow.shadows.map { it.spread })
    }

    @Test
    fun planSerializesForThePlugin() {
        val json = plan.toJson()
        assertEquals("Malachite", json["source"]!!.jsonObject["themeName"]!!.jsonPrimitive.content)
        val alias = json["collections"]!!.jsonArray[1].jsonObject["variables"]!!.jsonArray
            .map { it.jsonObject }
            .single { it["name"]!!.jsonPrimitive.content == "Surfaces/onDark/Accent/Transparent/Accent" }
        val light = alias["values"]!!.jsonObject["light"] as JsonObject
        assertEquals("alias", light["kind"]!!.jsonPrimitive.content)
        assertEquals(16.0, light["opacity"]!!.jsonPrimitive.content.toDouble())
    }

    @Test
    fun leafNamesDropTheCategoryWord() {
        assertEquals("Accent", leafName("transparent-accent", listOf("Accent", "Transparent")))
        assertEquals("AccentMinor", leafName("accent-minor", listOf("Accent", "Solid")))
        assertEquals("AccentMinor", leafName("accent-minor", listOf("Accent")))
        assertEquals("Solid", leafName("solid", listOf("General", "Solid")))
        assertEquals("BodyXS", styleName("body", "xs"))
    }

    @Test
    fun cssPaintParsing() {
        assertEquals(PlanColor(1.0, 1.0, 1.0, 0x80 / 255.0), parseHex("#FFFFFF80"))
        assertNull(parseHex("#12345"))
        val toRight = parsePaint("linear-gradient(to right, #000000, #FFFFFF 50%, #FF0000)") as PlanPaint.Linear
        assertEquals(90.0, toRight.angle)
        assertEquals(listOf(0.0, 0.5, 1.0), toRight.stops.map { it.first })
        val spread = parsePaint("linear-gradient(#000000 0%, #111111, #222222, #333333 90%)") as PlanPaint.Linear
        assertEquals(180.0, spread.angle)
        assertEquals(listOf(0.0, 0.3, 0.6, 0.9), spread.stops.map { kotlin.math.round(it.first * 10) / 10 })
        assertNull(parsePaint("radial-gradient(#000, #fff)"))
        assertNull(parsePaint("[general.gray.900]"))
    }
}
