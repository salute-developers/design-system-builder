package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import com.sdds.serv.theme.SddsServTheme

/**
 * Явное пустое состояние для пользователя, у которого нет ни одного доступного проекта —
 * не должно выглядеть как ошибка. Причина обычно в том, что владелец проекта ещё не добавил
 * пользователя участником; плагин не решает это сам (self-service запрос доступа вне скоупа).
 */
@Composable
public fun EmptyProjectsState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(SddsServTheme.spacing.spacing6x),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Пока нет доступных проектов",
            color = SddsServTheme.colors.textDefaultPrimary,
            style = SddsServTheme.typography.bodyMBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(SddsServTheme.spacing.spacing2x))
        Text(
            text = "Попросите владельца проекта DS Builder добавить вас участником.",
            color = SddsServTheme.colors.textDefaultSecondary,
            style = SddsServTheme.typography.bodyMNormal,
            textAlign = TextAlign.Center,
        )
    }
}
