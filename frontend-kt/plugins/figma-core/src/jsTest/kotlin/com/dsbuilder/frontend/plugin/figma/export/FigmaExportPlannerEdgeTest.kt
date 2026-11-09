package com.dsbuilder.frontend.plugin.figma.export

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Пограничные случаи плана: пустой источник, пропуски с причиной, контексты и порядок экранов. */
class FigmaExportPlannerEdgeTest {
    private val groups = """
        [
          {"id": "g-text", "parentId": null, "label": "Text & Icons"},
          {"id": "g-general", "parentId": "g-text", "label": "General"},
          {"id": "g-bg", "parentId": null, "label": "BG"},
          {"id": "g-bg-default", "parentId": "g-bg", "label": "Default"}
        ]
    """.trimIndent()

    private fun plan(json: String): FigmaExportPlan =
        FigmaExportPlanner.plan(Json.parseToJsonElement(json).jsonObject, ExportThemeInfo("T", "t", null))

    private fun radiusNames(plan: FigmaExportPlan) =
        plan.collections.single { it.name == "04. Numbers" }.variables.map { it.name }

    private fun theme(plan: FigmaExportPlan) = plan.collections.single { it.name == "01. Theme" }.variables

    @Test
    fun emptySourceGivesEmptyCollectionsInSampleOrder() {
        val plan = FigmaExportPlanner.plan(JsonObject(emptyMap()), ExportThemeInfo("T", "t", null))

        assertEquals(6, plan.collections.size)
        assertTrue(plan.collections.filter { it.name != "04. Numbers" }.all { it.variables.isEmpty() })
        // `null` = 0 есть в наборе образца всегда.
        assertEquals(
            listOf("CornerRadius/null"),
            plan.collections.single {
                it.name == "04. Numbers"
            }.variables.map { it.name },
        )
        assertTrue(plan.skipped.isEmpty())
    }

    @Test
    fun skippedTokenDoesNotTakeTheNameAndDuplicateIsReported() {
        val plan = plan(
            """
            {"groups": $groups,
             "tokens": [
               {"id": "a", "name": "text.default.primary", "type": "color", "enabled": true, "groupId": "g-general"},
               {"id": "b", "name": "text.default.primary", "type": "color", "enabled": true, "groupId": "g-general"},
               {"id": "c", "name": "text.default.primary", "type": "color", "enabled": true, "groupId": "g-general"},
               {"id": "d", "name": "text.default.broken", "type": "gradient", "enabled": true, "groupId": "g-general"}
             ],
             "values": [
               {"tokenId": "b", "platform": "web", "mode": "light", "value": ["#111111"]},
               {"tokenId": "c", "platform": "web", "mode": "light", "value": ["#222222"]},
               {"tokenId": "d", "platform": "web", "mode": "light", "value": ["radial-gradient(#000, #fff)"]}
             ]}
            """.trimIndent(),
        )

        assertEquals(listOf("theme:b"), theme(plan).map { it.key })
        assertEquals(
            listOf(
                PlanSkip("text.default.primary", "нет значений web"),
                PlanSkip(
                    "text.default.primary",
                    "имя Figma Text&Icons/Default/General/Primary уже занято токеном text.default.primary",
                ),
                PlanSkip("text.default.broken", "не удалось разобрать градиент: radial-gradient(#000, #fff)"),
            ),
            plan.skipped,
        )
    }

    @Test
    fun backgroundAndInverseContexts() {
        val plan = plan(
            """
            {"groups": $groups,
             "tokens": [
               {"id": "l", "name": "background.light.primary", "type": "color", "enabled": true,
                "groupId": "g-bg-default"},
               {"id": "i", "name": "background.inverse.primary", "type": "color", "enabled": true,
                "groupId": "g-bg-default"},
               {"id": "x", "name": "text.inverse.primary", "type": "color", "enabled": true, "groupId": "g-general"},
               {"id": "u", "name": "text.unknown.primary", "type": "color", "enabled": true, "groupId": "g-general"}
             ],
             "values": [
               {"tokenId": "l", "platform": "web", "mode": null, "value": ["#FFFFFF"]},
               {"tokenId": "i", "platform": "web", "mode": "dark", "value": ["#000000"]},
               {"tokenId": "x", "platform": "web", "mode": "light", "value": ["#000000"]},
               {"tokenId": "u", "platform": "web", "mode": "light", "value": ["#000000"]}
             ]}
            """.trimIndent(),
        )

        assertEquals(
            listOf("BG/onLight/Primary", "BG/Inverse/Primary", "Text&Icons/Inverse/General/Primary"),
            theme(plan).map { it.name },
        )
        // Значение без режима и значение только Dark заполняют оба режима.
        assertEquals(setOf("light", "dark"), theme(plan).first().values.keys)
        assertEquals(theme(plan)[1].values["light"], theme(plan)[1].values["dark"])
        assertEquals(PlanSkip("text.unknown.primary", "неизвестный контекст unknown"), plan.skipped.single())
        // Без контекста default подтема ссылается на первый найденный контекст и держит ключ его токена.
        val background = plan.collections.single { it.name == "02. SubTheme" }.variables.first()
        assertEquals("subtheme:l", background.key)
        assertEquals(PlanValue.Alias("theme:i"), background.values["inverse"])
        assertEquals(PlanValue.Alias("theme:l"), background.values["default"])
    }

    @Test
    fun typographyScreensInSampleOrderWithFallbackAndReportedSkips() {
        val style = { screen: String, size: Int ->
            """
            {"screen": "$screen", "styles": [{"group": "body", "size": "m", "sizePx": $size, "lineHeightPx": 20,
              "letterSpacingEm": 0, "fontFamily": "body",
              "variants": {"normal": {"tokenId": "n-$screen", "weight": 400}, "bold": {"tokenId": "b-$screen"},
                           "medium": {"tokenId": "off", "weight": 500}}}]}
            """.trimIndent()
        }
        val plan = plan(
            """
            {"tokens": [{"id": "off", "name": "screen-s.body.m.medium", "type": "typography", "enabled": false}],
             "typography": {"families": [{"name": "body", "fontName": "SB Sans Text"}],
               "screens": [${style("screen-s", 14)}, ${style("screen-l", 16)}]}}
            """.trimIndent(),
        )

        val typography = plan.collections.single { it.name == "03. Typography" }
        assertEquals(listOf("Large", "Medium", "Small"), typography.modes.map { it.name })
        val size = typography.variables.single { it.name == "Body/BodyM N/Font Size" }
        // Экрана Medium нет в ответе: он берёт значения первого доступного экрана.
        assertEquals(
            mapOf(
                "screen-l" to PlanValue.Number(16.0),
                "screen-m" to PlanValue.Number(16.0),
                "screen-s" to PlanValue.Number(14.0),
            ),
            size.values,
        )
        assertEquals(listOf(PlanSkip("body.m.bold", "у варианта нет насыщенности")), plan.skipped)
        assertEquals(1, plan.omittedDisabled)
        assertEquals(listOf("Body/BodyM N"), plan.textStyles.map { it.name })
    }

    @Test
    fun sizesWithoutValueAndBrokenShadowsAreReported() {
        val plan = plan(
            """
            {"sizes": {
              "radii": [{"tokenId": "r", "name": "round.m", "valuePx": null, "fullRounding": false}],
              "spacing": [],
              "shadows": [{"tokenId": "s", "name": "down.soft.s", "layers": [
                {"offsetX": 0, "offsetY": 4, "blur": 14, "spread": -4, "color": "#08080814"},
                {"offsetX": 0, "offsetY": 1, "blur": 4, "spread": -1, "color": "rgba(0,0,0,.1)"}]}]
            }}
            """.trimIndent(),
        )

        assertEquals(
            listOf("CornerRadius/null"),
            plan.collections.single {
                it.name == "04. Numbers"
            }.variables.map { it.name },
        )
        assertTrue(plan.effectStyles.isEmpty())
        assertEquals(
            listOf(
                PlanSkip("round.m", "нет значения в px"),
                PlanSkip("down.soft.s", "у тени нет слоёв или цвет слоя не распознан"),
            ),
            plan.skipped,
        )
    }

    @Test
    fun paletteRampsWithSameNameAreDistinguishedBySlot() {
        val plan = plan(
            """
            {"palette": {"groups": [{"id": "p", "label": "Accent", "ramps": [
              {"slot": {"type": "general", "shade": "green"}, "displayName": "Green",
               "steps": [{"step": 500, "value": "#1A9E32"}]},
              {"slot": {"type": "additional", "shade": "h130"}, "displayName": "Green",
               "steps": [{"step": 500, "value": "#1A9E33"}]}
            ]}], "tokens": []}}
            """.trimIndent(),
        )

        assertEquals(
            listOf("Accent/Green (general.green)/500", "Accent/Green (additional.h130)/500"),
            plan.collections.single { it.name == "00. Palette" }.variables.map { it.name },
        )
        assertTrue(plan.skipped.isEmpty())
    }

    @Test
    fun exactModeWinsOverValueWithoutModeAndEmptyGradientLayerIsSkipped() {
        val plan = plan(
            """
            {"groups": $groups,
             "tokens": [
               {"id": "a", "name": "text.default.primary", "type": "color", "enabled": true, "groupId": "g-general"},
               {"id": "g", "name": "text.default.accent-gradient", "type": "gradient", "enabled": true,
                "groupId": "g-general"}
             ],
             "values": [
               {"tokenId": "a", "platform": "web", "mode": null, "value": ["#222222"]},
               {"tokenId": "a", "platform": "web", "mode": "light", "value": ["#111111"]},
               {"tokenId": "g", "platform": "web", "mode": "light", "value": ["linear-gradient(#000000, #FFFFFF)"]},
               {"tokenId": "g", "platform": "web", "mode": "dark", "value": []}
             ]}
            """.trimIndent(),
        )

        val primary = theme(plan).single()
        assertEquals(PlanValue.Color(parseHex("#111111")!!), primary.values["light"])
        assertEquals(PlanValue.Color(parseHex("#222222")!!), primary.values["dark"])
        assertTrue(plan.paintStyles.isEmpty())
        assertEquals("text.default.accent-gradient", plan.skipped.single().name)
    }

    @Test
    fun disabledSizesAndShadowsAreOmitted() {
        val plan = plan(
            """
            {"tokens": [
              {"id": "r", "type": "shape", "enabled": false},
              {"id": "s", "type": "shadow", "enabled": false}
             ],
             "sizes": {
              "radii": [{"tokenId": "r", "name": "round.m", "valuePx": 12}],
              "spacing": [{"tokenId": "x", "name": "spacing.1x", "valuePx": 2}],
              "shadows": [{"tokenId": "s", "name": "down.soft.s", "layers": [
                {"offsetX": 0, "offsetY": 4, "blur": 14, "spread": -4, "color": "#08080814"}]}]
            }}
            """.trimIndent(),
        )

        assertEquals(
            listOf("CornerRadius/null"),
            plan.collections.single {
                it.name == "04. Numbers"
            }.variables.map { it.name },
        )
        assertEquals(1, plan.collections.single { it.name == "05. Spacing" }.variables.size)
        assertTrue(plan.effectStyles.isEmpty())
        assertEquals(2, plan.omittedDisabled)
    }

    @Test
    fun statesKeepTheBaseWordAndGradientStatesBecomeStyles() {
        val plan = plan(
            """
            {"groups": [
               {"id": "g-surface", "parentId": null, "label": "Surfaces"},
               {"id": "g-solid", "parentId": "g-surface", "label": "General / Solid"}
             ],
             "tokens": [
               {"id": "a", "name": "surface.default.solid", "type": "color", "enabled": true, "groupId": "g-solid"},
               {"id": "b", "name": "surface.default.solid-hover", "type": "color", "enabled": true, "groupId": "g-solid"},
               {"id": "c", "name": "surface.on-dark.solid-active", "type": "color", "enabled": true, "groupId": "g-solid"},
               {"id": "d", "name": "surface.default.solid-brightness", "type": "color", "enabled": true,
                "groupId": "g-solid"},
               {"id": "e", "name": "surface.default.solid-card-hover", "type": "gradient", "enabled": true,
                "groupId": "g-solid"}
             ],
             "values": [
               {"tokenId": "a", "platform": "web", "mode": null, "value": ["#111111"]},
               {"tokenId": "b", "platform": "web", "mode": null, "value": ["#222222"]},
               {"tokenId": "c", "platform": "web", "mode": null, "value": ["#333333"]},
               {"tokenId": "d", "platform": "web", "mode": null, "value": ["#444444"]},
               {"tokenId": "e", "platform": "web", "mode": null, "value": ["linear-gradient(#000000, #FFFFFF)"]}
             ]}
            """.trimIndent(),
        )

        assertEquals(
            listOf(
                "Surfaces/Default/General/Solid/Solid",
                "Surfaces/Default/General/Solid/SolidHover",
                "Surfaces/onDark/General/Solid/SolidActive",
                "Surfaces/Default/General/Solid/SolidBrightness",
            ),
            theme(plan).map { it.name },
        )
        // Состояние без контекста default: ключ и запасная ссылка — по первому контексту из Default, onDark, …
        val active = plan.collections.single { it.name == "02. SubTheme" }.variables
            .single { it.name == "Surfaces/General/Solid/SolidActive" }
        assertEquals("subtheme:c", active.key)
        assertEquals(PlanValue.Alias("theme:c"), active.values["default"])
        assertEquals(
            listOf("Light/Surfaces/Default/General/Solid/CardHover", "Dark/Surfaces/Default/General/Solid/CardHover"),
            plan.paintStyles.map { it.name },
        )
    }

    @Test
    fun secondZeroOrFullRadiusKeepsItsOwnName() {
        val plan = plan(
            """
            {"sizes": {"radii": [
              {"tokenId": "a", "name": "round.none", "valuePx": 0},
              {"tokenId": "b", "name": "round.xs", "valuePx": 0},
              {"tokenId": "c", "name": "round.circle", "fullRounding": true},
              {"tokenId": "d", "name": "round.pill", "fullRounding": true}
            ]}}
            """.trimIndent(),
        )

        assertEquals(
            listOf("CornerRadius/null", "CornerRadius/cRxs", "CornerRadius/Rounded", "CornerRadius/cRpill"),
            radiusNames(plan),
        )
        assertTrue(plan.skipped.isEmpty())
    }
}
