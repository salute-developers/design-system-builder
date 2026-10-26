package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.sdds.compose.uikit.Text
import com.sdds.serv.styles.basicbutton.style
import com.sdds.serv.styles.iconbutton.style
import com.sdds.serv.styles.tooltip.style
import com.sdds.serv.theme.SddsServTheme

internal fun Step.path(): List<Pair<String, Step>> = when (this) {
    is Step.PickProject -> emptyList()
    is Step.PickDesignSystem -> listOf(project.name to Step.PickProject)
    is Step.PickTenant -> listOf(project.name to Step.PickProject, designSystem.name to Step.PickDesignSystem(project))
    is Step.ShowTokens -> listOf(
        project.name to Step.PickProject,
        designSystem.name to Step.PickDesignSystem(project),
        tenant.name to Step.PickTenant(project, designSystem),
    )
}

@Composable
internal fun Breadcrumbs(path: List<Pair<String, Step>>, history: List<Step>, onSelect: (Step) -> Unit) {
    if (path.isEmpty()) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = SddsServTheme.spacing.spacing4x, vertical = SddsServTheme.spacing.spacing2x),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        path.forEachIndexed { index, (label, target) ->
            val isLast = index == path.lastIndex
            when {
                isLast -> Text(
                    text = label,
                    textColor = SddsServTheme.colors.textDefaultPrimary,
                    style = SddsServTheme.typography.bodySBold,
                )
                // Авто-выбранный шаг в историю не попадает — вернуться на него нельзя (выбор повторился бы сам).
                target in history -> BreadcrumbItem(label = label, onClick = { onSelect(target) })
                else -> Text(
                    text = label,
                    textColor = SddsServTheme.colors.textDefaultSecondary,
                    style = SddsServTheme.typography.bodySNormal,
                )
            }
            if (!isLast) {
                Text(
                    text = " / ",
                    textColor = SddsServTheme.colors.textDefaultSecondary,
                    style = SddsServTheme.typography.bodySNormal,
                )
            }
        }
    }
}

@Composable
private fun BreadcrumbItem(label: String, onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val isHovered by interactionSource.collectIsHoveredAsState()
    val isPressed by interactionSource.collectIsPressedAsState()
    val color = when {
        isPressed -> SddsServTheme.colors.textDefaultPrimaryActive
        isHovered -> SddsServTheme.colors.textDefaultPrimaryHover
        else -> SddsServTheme.colors.textDefaultPrimary
    }

    Text(
        text = label,
        textColor = color,
        style = SddsServTheme.typography.bodySNormal,
        // Без ripple/фона при ховере и клике — только смена цвета текста на hover/active токен.
        modifier = Modifier.clickable(interactionSource = interactionSource, indication = null, onClick = onClick),
    )
}
