package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import kotlin.test.Test
import kotlin.test.assertEquals

/** Первичная раскладка групп собирает семейство по правилу имени, а не по типу его членов. */
class InitialColorTokenGroupsTest {
    @Test
    fun `members with different types stay in one family`() {
        val definitions = listOf(
            ThemeTokenType.COLOR to "text.default.brand",
            ThemeTokenType.GRADIENT to "text.default.brand-hover",
            ThemeTokenType.COLOR to "text.on-dark.brand",
            ThemeTokenType.COLOR to "text.default.accent",
        ).map { (type, name) -> requireNotNull(ColorTokenFamily.of(type, name)) to name }

        val families = definitions.byFamilyName().associate { (family, names) -> family.name to names }

        assertEquals(
            mapOf(
                "brand" to listOf("text.default.brand", "text.default.brand-hover", "text.on-dark.brand"),
                "accent" to listOf("text.default.accent"),
            ),
            families,
        )
    }
}
