package com.dsbuilder.frontend.plugin.androidstudio.theme

import androidx.compose.runtime.Composable
import com.sdds.serv.theme.SddsServColors
import com.sdds.serv.theme.SddsServTheme
import com.sdds.serv.theme.darkSddsServColors
import com.sdds.serv.theme.lightSddsServColors

/**
 * Выбирает цветовую схему SDDS по яркости текущей темы IDE. Отдельная чистая функция —
 * чтобы мэппинг был тестируемым без реального Compose/IntelliJ Platform рантайма.
 */
public fun studioColors(isBrightIde: Boolean): SddsServColors =
    if (isBrightIde) lightSddsServColors() else darkSddsServColors()

/**
 * Оборачивает содержимое tool window в [SddsServTheme], подобрав цветовую схему под текущую
 * тему IDE (bright/non-bright).
 */
@Composable
public fun StudioTheme(isBrightIde: Boolean, content: @Composable () -> Unit) {
    SddsServTheme(colors = studioColors(isBrightIde), content = content)
}
