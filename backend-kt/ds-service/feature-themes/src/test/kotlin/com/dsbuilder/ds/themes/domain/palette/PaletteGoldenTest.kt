package com.dsbuilder.ds.themes.domain.palette

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals

/** Логика палитры темы `ds-service` против эталона `palette-golden.json`, общего с клиентом DS Builder. */
class PaletteGoldenTest {
    private val golden: JsonObject = Json.parseToJsonElement(resource("palette/palette-golden.json")).jsonObject
    private val scenario get() = golden.obj("scenario")

    @Test
    fun `группа токена по умолчанию`() {
        golden.array("defaultGroups").forEach { item ->
            val name = item.text("tokenName")
            assertEquals(item.text("group"), DefaultPaletteGroups.groupFor(name).wireValue, name)
        }
    }

    @Test
    fun `отображаемые имена`() {
        golden.array("displayNames").forEach { item ->
            val anchor = item.optional("anchor")?.let { PaletteAnchor(0, it.text("value")) }
            assertEquals(item.text("expected"), PaletteDisplayNames.of(ramp(item.obj("source")), anchor))
        }
    }

    @Test
    fun `перестройка совпадает с прототипом`() {
        val template = template()
        golden.array("rebuild").forEach { item ->
            val source = template.getValue(PaletteRampRef.parse(item.text("source"))!!)
            val result = PaletteRampRebuilder.rebuild(source, item.number("anchorStep"), item.text("value"))
            assertEquals(steps(item.obj("expected")), result, item.toString())
        }
    }

    @Test
    fun `сценарий палитры темы`() {
        val expected = scenario.obj("expected")
        val palette = scenarioPalette()
        assertEquals(expected.getValue("offBrand").jsonPrimitive.boolean, palette.offBrand)
        assertEquals(
            expected.array("tokens").map { Triple(it.text("tokenId"), it.text("groupId"), it.text("assignment")) },
            palette.tokens.map { Triple(it.tokenId, it.groupId, if (it.explicit) "explicit" else "default") },
        )
        expected.obj("groups").forEach { (groupId, ramps) ->
            val group = palette.groups.single { it.id == groupId }
            assertEquals(ramps.jsonArray.size, group.ramps.size, groupId)
            ramps.jsonArray.zip(group.ramps).forEach { (ramp, actual) -> assertRamp(ramp.jsonObject, actual) }
        }
        expected.array("resolve").forEach { item ->
            val reference = PaletteReference.parse(item.text("value"))!!
            assertEquals(item.optionalText("opacity")?.toDouble(), reference.opacity)
            val hex = ThemePaletteResolver.resolve(palette, item.text("tokenName"), reference.copy(opacity = null))
            assertEquals(item.text("hex"), hex, item.text("tokenName"))
        }
    }

    @Test
    fun `ссылка и прозрачность`() {
        assertEquals("[general.red.500][0.56]", PaletteReference.parse(" [general.red.500][0.56] ")!!.format())
        assertEquals("[additional.h130.300]", PaletteReference.parse("[additional.h130.300][1]")!!.format())
        assertEquals(null, PaletteReference.parse("[custom.x.500]"))
        assertEquals(null, PaletteReference.parse("[general.red.500][1.5]"))
        assertEquals("#1A9E3280", PaletteColors.withOpacity("#1A9E32", 0.5))
        assertEquals("#1A9E32", PaletteColors.withOpacity("#1A9E32", null))
    }

    @Test
    fun `порядок растяжек`() {
        val refs = listOf("additional.h20", "general.gray", "additional.h3", "general.coolGray", "general.red")
            .map { PaletteRampRef.parse(it)!! }
            .sortedWith(PaletteRampOrder)
            .map { it.key }
        assertEquals(listOf("general.coolGray", "general.gray", "general.red", "additional.h3", "additional.h20"), refs)
    }

    private fun assertRamp(expected: JsonObject, actual: PaletteRampView) {
        assertEquals(expected.text("slot"), actual.slot.key)
        assertEquals(expected.text("source"), actual.source.key)
        assertEquals(expected.text("displayName"), actual.displayName)
        assertEquals(expected.number("linkedCount"), actual.linkedCount)
        assertEquals(expected.getValue("modified").jsonPrimitive.boolean, actual.modified)
        expected.obj("steps").forEach { (step, values) ->
            val view = actual.steps.single { it.step == step.toInt() }
            assertEquals(values.text("value"), view.value)
            assertEquals(values.jsonObject.getValue("overridden").jsonPrimitive.boolean, view.overridden)
            assertEquals(values.number("linkedCount"), view.linkedCount)
            values.optionalText("templateValue")?.let { assertEquals(it, view.templateValue) }
        }
    }

    /** Палитра сценария эталона для состояния `state`. */
    internal fun scenarioPalette(state: TenantPaletteState = scenarioState()): ThemePalette =
        ThemePaletteBuilder.build("tenant", true, state, scenarioTokens(), scenarioValues())

    /** Цветовые токены сценария эталона. */
    internal fun scenarioTokens(): List<PaletteTokenRef> =
        scenario.array("tokens").map { PaletteTokenRef(it.text("id"), it.text("name"), it.text("displayName")) }

    /** Значения токенов сценария эталона. */
    internal fun scenarioValues(): List<PaletteTokenValue> = scenario.array("values").map { item ->
        val value = item.jsonObject.getValue("value").let { if (it is JsonArray) it.single() else it }
        val reference = PaletteReference.parse(value.jsonPrimitive.content)
        PaletteTokenValue(item.text("tokenId"), item.text("mode"), item.text("platform"), reference)
    }

    /** Состояние палитры сценария эталона. */
    internal fun scenarioState(): TenantPaletteState {
        val state = scenario.obj("state")
        return TenantPaletteState(
            editRevision = state.number("editRevision"),
            template = template(state.obj("template")),
            groups = state.array("groups").map { group ->
                StoredPaletteGroup(
                    id = group.text("id"),
                    kind = PaletteGroupKind.fromWire(group.text("kind"))!!,
                    systemKey = SystemPaletteGroup.fromWire(group.optionalText("systemKey")),
                    label = group.text("label"),
                )
            },
            ramps = state.array("ramps").map { ramp ->
                StoredPaletteRamp(
                    groupId = ramp.text("groupId"),
                    slot = ramp(ramp.obj("slot")),
                    source = ramp(ramp.obj("source")),
                    added = ramp.jsonObject.getValue("added").jsonPrimitive.boolean,
                    origin = PaletteRampOrigin.fromWire(ramp.text("origin"))!!,
                    anchor = ramp.optional("anchor")?.let { PaletteAnchor(it.number("step"), it.text("value")) },
                    steps = steps(ramp.obj("steps")),
                )
            },
            tokenGroups = state.obj("tokenGroups").mapValues { it.value.jsonPrimitive.content },
        )
    }

    /** Копия шаблона эталона. */
    internal fun template(source: JsonObject = golden.obj("template")): Map<PaletteRampRef, Map<Int, String>> =
        source.map { (key, steps) -> PaletteRampRef.parse(key)!! to steps(steps.jsonObject) }.toMap()

    private fun steps(source: JsonObject): Map<Int, String> =
        source.map { (step, value) -> step.toInt() to value.jsonPrimitive.content }.toMap()

    private fun ramp(source: JsonElement) = PaletteRampRef.parse("${source.text("type")}.${source.text("shade")}")!!

    private fun resource(path: String) =
        requireNotNull(javaClass.classLoader.getResourceAsStream(path)).bufferedReader().readText()

    private fun JsonElement.obj(name: String) = jsonObject.getValue(name).jsonObject

    private fun JsonElement.array(name: String) = jsonObject.getValue(name).jsonArray

    private fun JsonElement.optional(name: String) = jsonObject[name]?.takeIf { it != JsonNull }

    private fun JsonElement.optionalText(name: String) = optional(name)?.jsonPrimitive?.content

    private fun JsonElement.text(name: String) = optionalText(name).orEmpty()

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.int
}
