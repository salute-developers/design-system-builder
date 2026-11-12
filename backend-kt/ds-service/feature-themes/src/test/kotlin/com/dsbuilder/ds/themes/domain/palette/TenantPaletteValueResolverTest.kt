package com.dsbuilder.ds.themes.domain.palette

import kotlin.test.Test
import kotlin.test.assertEquals

/** Сравнивает индекс раскрытия с действующим контрактом полной палитры. */
class TenantPaletteValueResolverTest {
    @Test
    fun `indexed colors match full palette including missing steps and opacity`() {
        val fixture = PaletteGoldenTest()
        val state = fixture.scenarioState()
        val tokens = fixture.scenarioTokens()
        val palette = ThemePaletteBuilder.build("tenant", false, state, tokens, fixture.scenarioValues())
        val resolver = TenantPaletteValueResolver(state, tokens)
        assertEquals(palette.links, ThemePaletteBuilder.links(state, tokens, fixture.scenarioValues()))
        val names = tokens.map { it.name } + listOf("unknown.token", "text.primary.light", "text.primary.dark")
        for (name in names) {
            for ((ramp, steps) in state.template) {
                for (step in steps.keys + -1) {
                    for (opacity in listOf(null, 0.0, 0.56, 1.0)) {
                        val reference = PaletteReference(ramp, step, opacity)
                        assertEquals(
                            ThemePaletteResolver.resolve(palette, name, reference),
                            resolver.resolve(name, reference),
                            "$name ${reference.format()}",
                        )
                    }
                }
            }
        }
    }
}
