package com.dsbuilder.frontend.plugin.androidstudio.theme

import com.sdds.serv.theme.darkSddsServColors
import com.sdds.serv.theme.lightSddsServColors
import kotlin.test.Test
import kotlin.test.assertEquals

class StudioThemeTest {
    @Test
    fun brightIdeMapsToLightSddsTheme() {
        val expected = lightSddsServColors().textDefaultPrimary
        val actual = studioColors(isBrightIde = true).textDefaultPrimary

        assertEquals(expected, actual)
    }

    @Test
    fun nonBrightIdeMapsToDarkSddsTheme() {
        val expected = darkSddsServColors().textDefaultPrimary
        val actual = studioColors(isBrightIde = false).textDefaultPrimary

        assertEquals(expected, actual)
    }

    @Test
    fun lightAndDarkSchemesProduceDifferentPrimaryTextColor() {
        val light = studioColors(isBrightIde = true).textDefaultPrimary
        val dark = studioColors(isBrightIde = false).textDefaultPrimary

        kotlin.test.assertNotEquals(light, dark)
    }
}
