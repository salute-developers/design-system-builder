package com.dsbuilder.ds.themes.domain.palette

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations as Ops

/** Операции палитры темы на сценарии эталона — та же семантика, что у адаптера `local` клиента. */
class PaletteOperationsTest {
    private val golden = PaletteGoldenTest()
    private val green = PaletteRampRef(ThemePaletteType.GENERAL, "green")
    private val gray = PaletteRampRef(ThemePaletteType.GENERAL, "gray")
    private val h130 = PaletteRampRef(ThemePaletteType.ADDITIONAL, "h130")
    private val h190 = PaletteRampRef(ThemePaletteType.ADDITIONAL, "h190")

    private fun <T> applied(result: PaletteOperationResult<T>) = assertIs<PaletteOperationResult.Applied<T>>(result)

    private fun rejected(result: PaletteOperationResult<*>) = assertIs<PaletteOperationResult.Rejected>(result).error

    private fun palette(state: TenantPaletteState) = golden.scenarioPalette(state)

    @Test
    fun `группы создаются, переименовываются и удаляются`() {
        val state = golden.scenarioState()
        val created = applied(Ops.createGroup(state, " Icons ", { "g-icons" }))
        assertEquals(StoredPaletteGroup("g-icons", PaletteGroupKind.CUSTOM, null, "Icons"), created.value)
        assertEquals(state.editRevision + 1, created.state.editRevision)
        assertEquals(Ops.GROUP_EXISTS, rejected(Ops.createGroup(state, "accent", { "x" })).code)
        assertEquals(PaletteError.Kind.INVALID, rejected(Ops.createGroup(state, "  ", { "x" })).kind)

        assertEquals("Brand", applied(Ops.renameGroup(state, "g-avatars", "Brand")).value.label)
        assertEquals(Ops.GROUP_SYSTEM, rejected(Ops.renameGroup(state, "g-accent", "Brand")).code)
        assertEquals(Ops.GROUP_EXISTS, rejected(Ops.renameGroup(state, "g-avatars", "data")).code)

        val deleted = applied(Ops.deleteGroup(state, "g-avatars", palette(state))).state
        assertTrue(deleted.groups.none { it.id == "g-avatars" })
        assertTrue(deleted.tokenGroups.isEmpty())
        assertEquals("g-neutral", deleted.ramps.single { it.slot == h130 }.groupId)
        assertEquals(Ops.GROUP_SYSTEM, rejected(Ops.deleteGroup(state, "g-data", palette(state))).code)
        val withNew = state.groups + created.value.copy(label = "Новая группа")
        assertEquals("Новая группа 2", Ops.nextGroupLabel(withNew))
    }

    @Test
    fun `замена источника проверяет ступени связей`() {
        val state = golden.scenarioState()
        val replaced = applied(Ops.replaceSource(state, "g-accent", green, h130, palette(state))).state
        assertEquals(h130, replaced.ramps.single { it.groupId == "g-accent" }.source)

        // Токен ссылается на ступень 50, которой нет у h190: замена отклоняется со списком ступеней.
        val tokens = listOf(PaletteTokenRef("t2", "text.default.primary", "Primary"))
        val values = listOf(PaletteTokenValue("t2", "light", "web", PaletteReference(gray, 50, null)))
        val withStep50 = ThemePaletteBuilder.build("tenant", true, state, tokens, values)
        val missing = rejected(Ops.replaceSource(state, "g-neutral", gray, h190, withStep50))
        assertEquals(Ops.STEP_MISSING, missing.code)
        assertEquals(listOf(50), missing.steps)
    }

    @Test
    fun `перестройка, правка ступени и сброс правки значением источника`() {
        val state = golden.scenarioState()
        val rebuilt = applied(Ops.rebuild(state, "g-accent", green, 500, "#1f8a70", palette(state))).state
        val ramp = rebuilt.ramps.single { it.groupId == "g-accent" }
        assertEquals(PaletteRampOrigin.REBUILD, ramp.origin)
        assertEquals(PaletteAnchor(500, "#1F8A70"), ramp.anchor)
        val preview = applied(Ops.rebuildPreview(state, "g-accent", green, 500, "#1F8A70", palette(state)))
        assertEquals(state, preview.state.copy(editRevision = state.editRevision))
        val invalid = rejected(Ops.rebuild(state, "g-accent", green, 500, "nope", palette(state)))
        assertEquals(PaletteError.Kind.INVALID, invalid.kind)

        val edited = applied(Ops.updateStep(rebuilt, "g-accent", green, 500, "#e8114d", palette(rebuilt))).state
        assertEquals(PaletteAnchor(500, "#E8114D"), edited.ramps.single { it.groupId == "g-accent" }.anchor)
        assertEquals("Coral", palette(edited).ramp("g-accent", green)!!.displayName)

        val templateValue = state.template.getValue(h130).getValue(300).lowercase()
        val reset = applied(Ops.updateStep(state, "g-avatars", h130, 300, templateValue, palette(state))).state
        assertTrue(reset.ramps.single { it.groupId == "g-avatars" }.steps.isEmpty())
        val view = palette(reset).ramp("g-avatars", h130)!!
        assertEquals(false, view.modified)
        assertEquals(false, view.steps.single { it.step == 300 }.overridden)
        val missing = rejected(Ops.updateStep(state, "g-accent", green, 50, "#FFFFFF", palette(state)))
        assertEquals(PaletteError.Kind.NOT_FOUND, missing.kind)
    }

    @Test
    fun `удаление растяжки без стратегии, с заменой и с отвязкой`() {
        val state = golden.scenarioState()
        val palette = palette(state)
        assertEquals(Ops.RAMP_LINKED, rejected(Ops.removeRamp(state, "g-accent", green, null, null, palette)).code)

        val replaced = applied(Ops.removeRamp(state, "g-accent", green, RemoveRampStrategy.REPLACE, h130, palette))
        assertEquals(2, replaced.value.reassigned)
        assertEquals(TokenReferenceRewrite(listOf("t1"), green, h130), replaced.value.rewrite)
        assertTrue(replaced.state.ramps.any { it.groupId == "g-accent" && it.slot == h130 && it.added })
        val toReplacement = replaced.value.rewrite!!.rewrite(PaletteReference(green, 400, 0.5)) { null }
        assertEquals("[additional.h130.400][0.5]", toReplacement)

        val detached = applied(Ops.removeRamp(state, "g-accent", green, RemoveRampStrategy.DETACH, null, palette))
        val accent = palette.ramp("g-accent", green)!!
        val hexOf = { step: Int -> accent.steps.single { it.step == step }.value }
        val rewrite = detached.value.rewrite!!
        assertEquals(
            PaletteColors.withOpacity(hexOf(400), 0.5),
            rewrite.rewrite(PaletteReference(green, 400, 0.5), hexOf),
        )
        assertEquals(null, rewrite.rewrite(PaletteReference(h130, 300, null)) { "#000000" })
    }

    @Test
    fun `привязка токена к группе, сброс и добавление растяжки`() {
        val state = golden.scenarioState()
        val palette = palette(state)
        val assigned = applied(Ops.assignTokenGroup(state, "t2", "g-avatars", palette)).state
        assertEquals("g-avatars", assigned.tokenGroups["t2"])
        assertEquals(true, palette(assigned).tokens.single { it.tokenId == "t2" }.explicit)
        val reset = applied(Ops.assignTokenGroup(assigned, "t2", null, palette(assigned))).state
        assertEquals(null, reset.tokenGroups["t2"])
        assertEquals(PaletteError.Kind.NOT_FOUND, rejected(Ops.assignTokenGroup(state, "nope", null, palette)).kind)
        assertEquals(PaletteError.Kind.NOT_FOUND, rejected(Ops.assignTokenGroup(state, "t2", "missing", palette)).kind)
        assertEquals(Ops.RAMP_EXISTS, rejected(Ops.addRamp(state, "g-accent", green, palette)).code)
        val added = applied(Ops.addRamp(state, "g-data", h190, palette)).state
        assertTrue(added.ramps.any { it.groupId == "g-data" && it.added })
    }
}
