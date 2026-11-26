package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.sdds.compose.uikit.Text
import com.sdds.serv.theme.SddsServTheme

/** Подсказка в основной сцене: не создаёт Swing-слой, перехватывающий мышь у всей панели. */
@Composable
internal fun InlineTooltip(
    show: Boolean,
    text: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Layout(
        modifier = modifier.zIndex(1f),
        content = {
            content()
            if (show) {
                Text(
                    text = text,
                    style = SddsServTheme.typography.bodyXsNormal,
                    textColor = SddsServTheme.colors.textInversePrimary,
                    modifier = Modifier.background(
                        SddsServTheme.colors.surfaceDefaultSolidDefault,
                        RoundedCornerShape(8.dp),
                    ).padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        },
    ) { measurables, constraints ->
        val anchor = measurables.first().measure(constraints)
        val tooltip = measurables.getOrNull(1)?.measure(Constraints(maxWidth = 280.dp.roundToPx()))
        layout(anchor.width, anchor.height) {
            anchor.placeRelative(0, 0)
            // Кнопка находится у правого края; подсказка растёт влево и вверх, вдали от JCEF.
            tooltip?.placeRelative(anchor.width - tooltip.width, -tooltip.height - 4.dp.roundToPx())
        }
    }
}
